import { App } from '../../domain/entity/app.entity'
import type { IAppRepository } from '../../domain/repository-interface/app-repository.interface'
import type { SetupAutomationUseCase } from '../../../automation/application/use-case/setup-automation.use-case'
import type { SetupTableUseCase } from '../../../table/application/use-case/setup-table.use-case'
import type { ValidateAppUseCase } from './validate-app.use-case'
import type { SetupConnectionUseCase } from '../../../connection/application/use-case/setup-connection.use-case'
import type { SetupBucketUseCase } from '../../../bucket/application/use-case/setup-bucket.use-case'
import type { HandleConnectionErrorUseCase } from '../../../connection/application/use-case/handle-connection-error.use-case'
import type { IConnectionRepository } from '../../../connection/domain/repository-interface/connection-repository.interface'
import type { ConnectionSchema } from '../../../../shared/integrations/core/connection.schema'

// eslint-disable-next-line
import type { SimpleContainer } from '../../../../shared/infrastructure/di/simple-container'

export class StartAppUseCase {
  constructor(
    private readonly appRepository: IAppRepository,
    private readonly setupAutomationUseCase: SetupAutomationUseCase,
    private readonly setupTableUseCase: SetupTableUseCase,
    private readonly setupConnectionUseCase: SetupConnectionUseCase,
    private readonly validateAppUseCase: ValidateAppUseCase,
    private readonly setupBucketUseCase: SetupBucketUseCase,
    private readonly handleConnectionErrorUseCase: HandleConnectionErrorUseCase,
    private readonly connectionRepository: IConnectionRepository,
    private readonly container: SimpleContainer
  ) {}

  async execute(unknownSchema: unknown): Promise<App> {
    this.appRepository.info('Starting app...')
    const env = await this.appRepository.loadEnv()
    const { schema, error } = await this.validateAppUseCase.execute(unknownSchema)
    if (!schema) {
      this.appRepository.error(error)
      throw new Error('Invalid app schema')
    }
    schema.connections = schema.connections.map((connection) => {
      return this.appRepository.fillSchemaEnvVariables<ConnectionSchema>(connection)
    })
    const app = new App(schema, env)
    await this.appRepository.setup(app)

    // Setup app context in Hono
    const setupAppContext = this.container.get<(app: App) => void>('setupAppContext')
    setupAppContext(app)
    for (const connection of app.connections) {
      await this.setupConnectionUseCase.execute(connection)
    }

    // Handle any connections that failed during setup
    const connectionStatuses = await this.connectionRepository.status.listByIds(
      app.connections.map((c) => c.id)
    )
    for (const status of connectionStatuses) {
      if (!status.connected) {
        const connection = app.findConnection(status.id)
        if (connection) {
          // Deactivate automations using this failed connection
          const error = new Error('Connection failed during token refresh')
          await this.handleConnectionErrorUseCase.execute(app, connection, error)
        }
      }
    }

    for (const table of app.tables) {
      await this.setupTableUseCase.execute(table)
    }
    for (const automation of app.automations) {
      await this.setupAutomationUseCase.execute(app, automation)
    }
    for (const bucket of app.buckets) {
      await this.setupBucketUseCase.execute(bucket)
    }
    process.on('SIGINT', () => this.shutdown())
    process.on('SIGTERM', () => this.shutdown())
    process.on('SIGQUIT', () => this.shutdown())
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err)
      process.exit(1)
    })

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason)
      process.exit(1)
    })
    await this.appRepository.start(app)
    this.appRepository.info(`App "${app.schema.name}" is running at ${app.url()}`)
    return app
  }

  async shutdown() {
    this.appRepository.info('Shutting down app...')
    await this.appRepository.stop()
    this.appRepository.info('App shut down')
    process.exit(0)
  }
}
