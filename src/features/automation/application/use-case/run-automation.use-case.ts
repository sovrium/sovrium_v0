import type { RunActionUseCase } from '../../../action/application/use-case/run-action.use-case'
import type { IRunRepository } from '../../../run/domain/repository-interface/run-repository.interface'
import { Run } from '../../../run/domain/entity/run.entity'
import type { IAutomationRepository } from '../../domain/repository-interface/automation-repository.interface'
import type { Automation } from '../../domain/entity/automation.entity'
import type { App } from '../../../../features/app/domain/entity/app.entity'
import type { IntegrationError, ServiceError } from '../../../action/domain/value-object'
import type { SplitIntoPathsFilterActionSchema } from '../../../action/domain/schema/filter/split-into-paths.schema'
import type { ActionSchema } from '../../../action/domain/schema/action.schema'

export class RunAutomationUseCase {
  debug: (message: string) => void
  info: (message: string) => void
  error: (message: string) => void

  constructor(
    private readonly automationRepository: IAutomationRepository,

    private readonly runRepository: IRunRepository,

    private readonly runActionUseCase: RunActionUseCase
  ) {
    this.debug = (message: string) => this.automationRepository.debug(message)
    this.info = (message: string) => this.automationRepository.info(message)
    this.error = (message: string) => this.automationRepository.error(message)
  }

  async execute(app: App, run: Run, automation: Automation, pathName?: string) {
    try {
      if (pathName) {
        this.info(`playing path "${pathName}"`)
        const path = automation.findPath(pathName)

        if (path.actions.length > 0) {
          for (const action of path.actions) {
            const actionPath = pathName + '.' + action.name
            if (run.isStepExecutedWithSuccess(actionPath)) {
              this.debug(`action "${actionPath}" has already been successfully run`)
              continue
            } else {
              run.removeStep(action.name)
            }
            const shouldContinue = await this.runAction(app, run, automation, action, pathName)
            if (!shouldContinue) break
          }
        } else {
          this.debug(`path "${pathName}" has no actions`)
        }
        this.info(`path "${pathName}" finished`)
      } else {
        this.info(`playing automation "${automation.schema.name}"`)
        if (automation.actions.length === 0) {
          this.debug(`automation "${automation.schema.name}" has no actions`)
          run.runSucceed()
          await this.runRepository.update(run)
        } else {
          let allActionsSucceeded = true
          for (const action of automation.actions) {
            // Special handling for split-into-paths actions during replay
            if (action.service === 'filter' && action.action === 'split-into-paths') {
              const step = run.getActionOrPathsStep(action.name)
              if (step && step.type === 'paths') {
                // Check if any paths have errors - if so, re-execute the action
                const hasPathErrors = step.paths.some((path) =>
                  path.actions.some((action) => action.error)
                )
                if (hasPathErrors) {
                  this.debug(`action "${action.name}" has path errors, re-executing`)
                  run.removeStep(action.name)
                  const shouldContinue = await this.runAction(app, run, automation, action)
                  if (!shouldContinue) {
                    allActionsSucceeded = false
                    break
                  }
                  continue
                }
              }
            }

            if (run.isStepExecutedWithSuccess(action.name)) {
              this.debug(`action "${action.name}" has already been successfully run`)
              continue
            } else {
              run.removeStep(action.name)
            }
            const shouldContinue = await this.runAction(app, run, automation, action)
            if (!shouldContinue) {
              allActionsSucceeded = false
              break
            }
          }
          if (allActionsSucceeded) {
            run.runSucceed()
            await this.runRepository.update(run)
          } else {
            // If any action failed, mark the entire run as stopped
            // But don't override if the run is already filtered
            if (run.status !== 'filtered') {
              const errorMessage = 'Automation stopped due to action failure'
              this.error(errorMessage)
              run.stopActionStep('execution', { message: errorMessage } as ServiceError)
            }
            await this.runRepository.update(run)
          }
        }
        this.info(`automation "${automation.schema.name}" finished`)
      }
    } catch (error) {
      if (error instanceof Error) {
        let message = error.message
        if (pathName) {
          message = `path "${pathName}" failed: ${error.message}`
          // For path execution, re-throw the error so the caller knows the path failed
          this.error(message)
          throw error
        } else {
          message = `automation "${automation.schema.name}" failed: ${error.message}`
          this.error(message)
          run.stopActionStep('execution', error)
          await this.runRepository.update(run)
          await this.automationRepository.sendAlertEmail(run, automation, message)
        }
      } else {
        throw error
      }
    }
  }

  private async runAction(
    app: App,
    run: Run,
    automation: Automation,
    action: ActionSchema,
    pathName?: string
  ): Promise<boolean> {
    const actionPath = pathName ? pathName + '.' + action.name : action.name

    const { data, error } = await this.runActionUseCase.execute(app, action, run, actionPath)

    if (error) {
      await this.stop(run, automation, actionPath, error)
      return false
    }

    if (action.service === 'filter' && 'canContinue' in data && !data.canContinue) {
      await this.filter(run, actionPath, data)
      return false
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        await this.filter(run, actionPath, data)
        return false
      }
      for (let i = 0; i < data.length; i++) {
        const item = { ...data[i], index: i + 1 }
        if (i === 0) {
          run.successActionStep(actionPath, item)
          await this.runRepository.update(run)
          this.info(`action "${action.name}" succeeded`)
        } else {
          const newRun = run.clone()
          newRun.successActionStep(actionPath, item)
          await this.runRepository.create(newRun)
          this.debug(`create new run for action "${action.name}"`)
        }
      }
      return true
    } else {
      run.successActionStep(actionPath, data)
      await this.runRepository.update(run)
      if (action.service === 'filter' && action.action === 'split-into-paths') {
        try {
          await this.executePaths(app, run, automation, action, data, pathName)
        } catch (pathError) {
          this.error(
            `Split-into-paths action ${actionPath} failed during path execution: ${pathError instanceof Error ? pathError.message : String(pathError)}`
          )
          const serviceError = {
            message: `Path failure in multi-step execution: ${pathError instanceof Error ? pathError.message : String(pathError)}`,
          } as ServiceError
          await this.stop(run, automation, actionPath, serviceError)
          return false
        }
        const step = run.getActionOrPathsStep(actionPath)
        if (step && step.type === 'paths') {
          if (step.paths.every((path) => path.output.canContinue === false)) {
            await this.filter(run, actionPath, data)
            return false
          }
          if (step.paths.some((path) => path.actions.some((action) => action.error))) {
            // Find the first path with an error to get error details
            const failedPath = step.paths.find((path) =>
              path.actions.some((action) => action.error)
            )
            if (failedPath) {
              const failedAction = failedPath.actions.find((action) => action.error)
              if (failedAction && failedAction.error) {
                const pathFailureMessage = `Path failure in multi-step execution: ${failedAction.error.message}`
                const pathError = { message: pathFailureMessage } as ServiceError
                await this.stop(run, automation, actionPath, pathError)
                return false
              }
            }
            const pathError = { message: 'Path failure in multi-step execution' } as ServiceError
            await this.stop(run, automation, actionPath, pathError)
            return false
          }
        }
      }
      this.info(`action "${action.name}" succeeded`)
    }

    return true
  }

  private async stop(
    run: Run,
    automation: Automation,
    actionPath: string,
    error: IntegrationError | ServiceError
  ) {
    const message = `action "${actionPath}" stopped with error: ${error.message}`
    this.error(message)
    run.stopActionStep(actionPath, error)
    await this.runRepository.update(run)
    await this.automationRepository.sendAlertEmail(run, automation, message)
  }

  private async filter(run: Run, actionPath: string, data: Record<string, unknown>) {
    this.info(`action "${actionPath}" filtered`)
    run.filterActionStep(actionPath, data)
    await this.runRepository.update(run)
  }

  private async executePaths(
    app: App,
    run: Run,
    automation: Automation,
    schema: SplitIntoPathsFilterActionSchema,
    data: Record<string, unknown>,
    pathName?: string
  ) {
    // Execute all paths and collect any errors
    this.debug(`executePaths: data keys: ${Object.keys(data).join(', ')}`)
    let hasPathFailure = false
    let pathFailureError: Error | null = null

    for (const path of schema.params) {
      const nextPathName = (pathName ? pathName + '.' : '') + schema.name + '.' + path.name
      const result = data[path.name]
      this.debug(`executePaths: Path ${path.name} result: ${JSON.stringify(result)}`)

      if (
        result &&
        typeof result === 'object' &&
        'canContinue' in result &&
        result.canContinue === true
      ) {
        try {
          this.info(`executePaths: Executing path ${nextPathName}`)
          await this.execute(app, run, automation, nextPathName)
          this.info(`executePaths: Path ${nextPathName} completed successfully`)
        } catch (error) {
          // Record the failure but continue executing other paths
          hasPathFailure = true
          if (error instanceof Error) {
            this.error(`Path execution failed for ${nextPathName}: ${error.message}`)
            if (!pathFailureError) {
              pathFailureError = new Error(`Path failure: ${error.message}`)
            }
          } else if (!pathFailureError) {
            pathFailureError = new Error('Path failure: Unknown error')
          }
          // Continue to execute other paths instead of throwing immediately
        }
      } else {
        this.info(
          `executePaths: Skipping path ${path.name} - canContinue is false or result invalid`
        )
      }
    }

    // After all paths have been attempted, throw error if any failed
    if (hasPathFailure && pathFailureError) {
      throw pathFailureError
    }
  }
}
