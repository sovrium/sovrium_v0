import crypto from 'crypto'
import type { IntegrationError } from '../../../action/domain/value-object/integration-error.value-object'
import type { ServiceError } from '../../../../features/action/domain/value-object/service-error.value-object'
import type { Steps } from '../value-object.ts/step.value-object'
import type { ActionSchema } from '../../../../features/action/domain/schema/action.schema'
import type { ActionOrPathsStep } from '../value-object.ts/step.value-object'
import type { PathStep } from '../value-object.ts/paths-step.value-object'
import type { SplitIntoPathsFilterActionSchema } from '../../../../features/action/domain/schema/filter/split-into-paths.schema'

export type RunStatus = 'playing' | 'success' | 'stopped' | 'filtered'

export class Run {
  constructor(
    public readonly automation_id: number,
    public readonly steps: Steps,
    public readonly form_id: number | null = null,
    private _status: RunStatus = 'playing',
    public readonly id: string = crypto.randomUUID(),
    public readonly createdAt: Date = new Date(),
    private _updatedAt: Date = new Date(),
    private _toReplay: boolean = false
  ) {}

  get status() {
    return this._status
  }

  get updatedAt() {
    return this._updatedAt
  }

  get toReplay() {
    return this._toReplay
  }

  clone(): Run {
    return new Run(
      this.automation_id,
      JSON.parse(JSON.stringify(this.steps)),
      this.form_id,
      this._status,
      crypto.randomUUID(),
      this.createdAt,
      this._updatedAt
    )
  }

  replay() {
    this._toReplay = true
  }

  replaying() {
    this._status = 'playing'
    this._updatedAt = new Date()
    this._toReplay = false
  }

  startActionStep(actionPath: string, schema: ActionSchema, input: Record<string, unknown>) {
    const pathSegments = actionPath.split('.')
    if (pathSegments.length < 2) {
      this.steps.push({
        type: 'action',
        startedAt: new Date().toISOString(),
        schema,
        input,
        output: undefined,
        error: undefined,
      })
      this._updatedAt = new Date()
    } else {
      const [actionName, pathName, ...segments] = pathSegments
      const step = this.getActionOrPathsStepOrThrow(actionName!)
      if (step.type === 'paths') {
        const path = step.paths.find((path) => path.schema.name === pathName)
        if (!path) {
          throw new Error('Path step not found')
        }
        if (segments.length < 2) {
          path.actions.push({
            type: 'action',
            startedAt: new Date().toISOString(),
            schema,
            input,
            output: undefined,
            error: undefined,
          })
          this._updatedAt = new Date()
        } else {
          this.startActionStep(segments.join('.'), schema, input)
        }
      } else {
        throw new Error('Action step not found')
      }
    }
  }

  startActionPathsStep(schema: SplitIntoPathsFilterActionSchema, paths: PathStep[]) {
    this.steps.push({
      type: 'paths',
      startedAt: new Date().toISOString(),
      schema: {
        name: schema.name,
        service: schema.service,
        action: schema.action,
      },
      paths,
    })
    this._updatedAt = new Date()
  }

  getActionOrPathsStep(
    actionPath: string,
    steps?: ActionOrPathsStep[]
  ): ActionOrPathsStep | undefined {
    const pathSegments = actionPath.split('.')
    if (pathSegments.length < 2) {
      const actionName = pathSegments[0]!
      for (const step of steps ?? this.steps) {
        if (('input' in step || 'paths' in step) && step.schema.name === actionName) {
          return step
        }
      }
      return
    } else {
      const [actionName, pathName, ...segments] = pathSegments
      const step = this.getActionOrPathsStep(actionName!)
      if (!step) return
      if ('paths' in step) {
        const path = step.paths.find((path) => path.schema.name === pathName)
        if (!path) {
          throw new Error('Path step not found')
        }
        if (segments.length > 0) {
          return this.getActionOrPathsStep(segments.join('.'), path.actions)
        }
        return step
      }
    }
  }

  getActionOrPathsStepOrThrow(actionPath: string): ActionOrPathsStep {
    const step = this.getActionOrPathsStep(actionPath)
    if (!step) throw new Error(`Action step "${actionPath}" not found`)
    return step
  }

  getStepsOutput() {
    const [trigger, ...actions] = this.steps
    const buildOutput = (steps: ActionOrPathsStep[]): Record<string, unknown> => {
      return steps.reduce((acc: Record<string, unknown>, step) => {
        if ('paths' in step) {
          acc[step.schema.name] = step.paths.reduce((acc: Record<string, unknown>, path) => {
            acc[path.schema.name] = buildOutput(path.actions)
            return acc
          }, {})
        } else if ('action' in step.schema) {
          acc[step.schema.name] = step.output ?? {}
        }
        return acc
      }, {})
    }
    const output = buildOutput(actions)
    return {
      ...output,
      trigger: trigger.output,
    }
  }

  isStepExecuted(actionPath: string) {
    const step = this.getActionOrPathsStep(actionPath)
    if (!step) return false
    if ('output' in step) return !!step.output
    if ('error' in step) return !!step.error
    return true
  }

  isStepExecutedWithSuccess(actionPath: string) {
    const step = this.getActionOrPathsStep(actionPath)
    if (!step) return false
    if ('error' in step) return !step.error
    if ('output' in step) {
      return !!step.output
    }
    // For paths steps, check if any path actions have errors
    if ('paths' in step) {
      const pathsStep = step as { paths: Array<{ actions: Array<{ error?: unknown }> }> }
      const hasPathErrors = pathsStep.paths.some((path) =>
        path.actions.some((action) => action.error)
      )
      return !hasPathErrors
    }
    return true
  }

  removeStep(actionPath: string) {
    const pathSegments = actionPath.split('.')
    if (pathSegments.length < 2) {
      // Remove from main steps array
      const actionName = pathSegments[0]!
      const stepIndex = this.steps.findIndex((step, index) => {
        // Skip trigger step (index 0)
        if (index === 0) return false
        return ('input' in step || 'paths' in step) && step.schema.name === actionName
      })

      if (stepIndex !== -1) {
        this.steps.splice(stepIndex, 1)
        this._updatedAt = new Date()
      }
    } else {
      // Remove from path
      const [actionName, pathName, ...segments] = pathSegments
      const step = this.getActionOrPathsStep(actionName!)

      if (step && 'paths' in step) {
        const path = step.paths.find((path) => path.schema.name === pathName)
        if (path) {
          if (segments.length < 2) {
            // Remove action from this path
            const actionNameInPath = segments[0]!
            const actionIndex = path.actions.findIndex(
              (action) => action.schema.name === actionNameInPath
            )
            if (actionIndex !== -1) {
              path.actions.splice(actionIndex, 1)
              this._updatedAt = new Date()
            }
          } else {
            // Recursively remove from nested path
            this.removeStep(segments.join('.'))
          }
        }
      }
    }
  }

  successActionStep(actionPath: string, output: Record<string, unknown>) {
    const step = this.getActionOrPathsStepOrThrow(actionPath)
    if ('output' in step) step.output = output
    step.finishedAt = new Date().toISOString()
    this._updatedAt = new Date()
  }

  filterActionStep(actionPath: string, result: Record<string, unknown>) {
    if (this._status === 'playing') {
      const step = this.getActionOrPathsStepOrThrow(actionPath)
      if ('output' in step) step.output = result
      step.finishedAt = new Date().toISOString()
      this._updatedAt = new Date()
      this._status = 'filtered'
    }
  }

  stopActionStep(actionPath: string, error: IntegrationError | ServiceError) {
    if (this._status === 'playing' || this._status === 'filtered') {
      const step = this.getActionOrPathsStep(actionPath)
      if (step) {
        if ('error' in step) step.error = error
        step.finishedAt = new Date().toISOString()
      }
      this._updatedAt = new Date()
      this._status = 'stopped'
    }
  }

  runSucceed() {
    if (this._status === 'playing') {
      this._status = 'success'
    }
  }

  getLastActionStepData() {
    const buildData = (step: ActionOrPathsStep): Record<string, unknown> => {
      if ('paths' in step) {
        return step.paths.reduce((acc: Record<string, unknown>, path) => {
          const lastAction = path.actions[path.actions.length - 1]!
          if (lastAction) {
            acc[path.schema.name] = buildData(lastAction)
          }
          return acc
        }, {})
      } else {
        return step.output ?? {}
      }
    }
    const lastAction = this.getLastActionStep()
    if (!lastAction) {
      return {}
    }
    return buildData(lastAction)
  }

  getLastActionStep() {
    const [, ...actions] = this.steps
    return actions[actions.length - 1]
  }

  getErrorMessage() {
    const getError = (steps: ActionOrPathsStep[]) => {
      for (const step of steps) {
        if ('paths' in step) {
          return getError(step.paths.flatMap((path) => path.actions))
        }
        if ('error' in step && step.error !== undefined) {
          return step.error
        }
      }
    }
    const [, ...actions] = this.steps
    const error = getError(actions)
    if (error) {
      return error.message
    }
    return undefined
  }
}
