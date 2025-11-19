import type { IActionRepository } from '../../domain/repository-interface/action-repository.interface'
import type { Run } from '../../../run/domain/entity/run.entity'
import type { ActionResult } from '../../domain/value-object/action-result.value-object'
import type { App } from '../../../app/domain/entity/app.entity'
import type { RunFilterUseCase } from './run-filter.use-case'
import type { ActionSchema } from '../../domain/schema/action.schema'
import type { IRunRepository } from '../../../run/domain/repository-interface/run-repository.interface'
import type { PathStep } from '../../../run/domain/value-object.ts/paths-step.value-object'
import { toRecordDto } from '../../../table/application/dto/record.dto'

export class RunActionUseCase {
  constructor(
    private readonly actionRepository: IActionRepository,
    private readonly runFilterUseCase: RunFilterUseCase,
    private readonly runRepository: IRunRepository
  ) {}

  async execute(
    app: App,
    action: ActionSchema,
    run: Run,
    actionPath: string
  ): Promise<ActionResult> {
    this.actionRepository.log.debug(`running action "${action.name}"`)
    try {
      let data: Record<string, unknown> = {}
      const fillInputData = <T extends Record<string, unknown>>(params: T) =>
        this.fillInputData(params, actionPath, action, run)
      switch (action.service) {
        case 'code': {
          switch (action.action) {
            case 'run-typescript': {
              const { inputData, code } = await fillInputData(action.params)
              data = await this.actionRepository.code(app, inputData).runTypescript(code)
              break
            }
            case 'run-javascript': {
              const { inputData, code } = await fillInputData(action.params)
              data = await this.actionRepository.code(app, inputData).runJavascript(code)
              break
            }
            default: {
              const _exhaustiveCheck: never = action
              throw new Error(`Unhandled case: ${_exhaustiveCheck}`)
            }
          }
          break
        }
        case 'http': {
          switch (action.action) {
            case 'get': {
              const { url, headers } = await fillInputData(action.params)
              data = await this.actionRepository.http(url, { headers }).get()
              break
            }
            case 'post': {
              const { url, headers, body } = await fillInputData(action.params)
              data = await this.actionRepository.http(url, { headers }).post(body)
              break
            }
            case 'response': {
              data = await fillInputData(action.params ?? {})
              break
            }
            default: {
              const _exhaustiveCheck: never = action
              throw new Error(`Unhandled case: ${_exhaustiveCheck}`)
            }
          }
          break
        }
        case 'filter': {
          switch (action.action) {
            case 'only-continue-if': {
              const params = await fillInputData(action.params)
              data = await this.runFilterUseCase.execute(params, run)
              break
            }
            case 'split-into-paths': {
              const paths: { [key: string]: object } = {}
              const pathsSteps: PathStep[] = []
              this.actionRepository.log.debug(
                `split-into-paths: Processing ${action.params.length} paths`
              )
              for (const path of action.params) {
                try {
                  this.actionRepository.log.debug(`split-into-paths: Processing path ${path.name}`)
                  const output = run.getStepsOutput()
                  const filter = this.actionRepository.fillSchema(path.filter, output)
                  const result = await this.runFilterUseCase.execute(filter, run)
                  this.actionRepository.log.debug(
                    `split-into-paths: Path ${path.name} filter result: ${JSON.stringify(result)}`
                  )
                  paths[path.name] = result
                  pathsSteps.push({
                    schema: path,
                    input: filter,
                    output: result,
                    actions: [],
                  })
                } catch (error) {
                  this.actionRepository.log.error(
                    `split-into-paths: Error processing path ${path.name}: ${error}`
                  )
                  // Still create the path but with canContinue: false
                  paths[path.name] = { canContinue: false, error: String(error) }
                  pathsSteps.push({
                    schema: path,
                    input: path.filter,
                    output: { canContinue: false, error: String(error) },
                    actions: [],
                  })
                }
              }
              this.actionRepository.log.debug(
                `split-into-paths: Created ${pathsSteps.length} path steps`
              )
              run.startActionPathsStep(action, pathsSteps)
              await this.runRepository.update(run)
              data = paths
              break
            }
            default: {
              const _exhaustiveCheck: never = action
              throw new Error(`Unhandled case: ${_exhaustiveCheck}`)
            }
          }
          break
        }
        case 'database': {
          switch (action.action) {
            case 'create-record': {
              const { table: tableNameOrId, fields } = await fillInputData(action.params)
              const table = app.findTable(tableNameOrId)
              if (!table) {
                throw new Error(`Table not found: ${tableNameOrId}`)
              }
              const record = await this.actionRepository.database(table).create(fields)
              data = toRecordDto(record)
              break
            }
            default: {
              const _exhaustiveCheck: never = action
              throw new Error(`Unhandled case: ${_exhaustiveCheck}`)
            }
          }
          break
        }
        default: {
          const connection = app.findConnection(action.account)
          if (!connection) {
            throw new Error(`Connection not found for account ${action.account}`)
          }
          const filledAction = JSON.parse(JSON.stringify(action))
          filledAction.params = await fillInputData(filledAction.params ?? {})
          return await this.actionRepository.runIntegration(filledAction, connection)
        }
      }
      if (!data) data = {}
      return { data }
    } catch (error) {
      if (error instanceof Error) {
        this.actionRepository.log.error(error.message)
        return { error: { message: error.message } }
      } else {
        this.actionRepository.log.error(String(error))
        return { error: { message: 'Unknown error' } }
      }
    }
  }

  async fillInputData<T extends Record<string, unknown>>(
    inputData: T,
    actionPath: string,
    action: ActionSchema,
    run: Run
  ): Promise<T> {
    const output = run.getStepsOutput()
    const inputDataFilled = this.actionRepository.fillSchema(inputData, output)
    run.startActionStep(actionPath, action, inputDataFilled)
    await this.runRepository.update(run)
    return inputDataFilled
  }
}
