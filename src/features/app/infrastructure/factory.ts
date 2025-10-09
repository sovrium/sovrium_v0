import { SimpleContainer } from '../../../shared/infrastructure/di/simple-container'

// Infrastructure
import { AppRepository } from './repository/app.repository'

// Use Cases
import { ValidateAppUseCase } from '../application/use-case/validate-app.use-case'
import { GetAppMetadataUseCase } from '../application/use-case/get-app-metadata.use-case'
import { GetAdminMetadataUseCase } from '../application/use-case/get-admin-metadata.use-case'
import { StartAppUseCase } from '../application/use-case/start-app.use-case'

// Context
import { AppHonoContext } from './di/context'

// Dependencies (will be available in container by now)
import type { SetupAutomationUseCase } from '../../automation/application/use-case/setup-automation.use-case'
import type { SetupTableUseCase } from '../../table/application/use-case/setup-table.use-case'
import type { SetupConnectionUseCase } from '../../connection/application/use-case/setup-connection.use-case'
import type { SetupBucketUseCase } from '../../bucket/application/use-case/setup-bucket.use-case'
import type { HandleConnectionErrorUseCase } from '../../connection/application/use-case/handle-connection-error.use-case'
import type { AuthService } from '../../user/infrastructure/service/auth.service'
import type { EnvService } from '../../../shared/infrastructure/service/env.service'
import type { LoggerService } from '../../../shared/infrastructure/service/logger.service'
import type { TemplateService } from '../../../shared/infrastructure/service/template.service'
import type { ServerService } from '../../../shared/infrastructure/service/server.service'
import type { DatabaseService } from '../../../shared/infrastructure/service/database.service'
import type { AutomationRepository } from '../../automation/infrastructure/repository/automation.repository'
import type { ConnectionRepository } from '../../connection/infrastructure/repository/connection.repository'

export interface AppServices {
  repositories: {
    app: AppRepository
  }
  useCases: {
    validate: ValidateAppUseCase
    getAppMetadata: GetAppMetadataUseCase
    getAdminMetadata: GetAdminMetadataUseCase
    start: StartAppUseCase
  }
  context: AppHonoContext
}

export function createAppServices(container: SimpleContainer): AppServices {
  // Get dependencies from container
  const env = container.get<EnvService>('env')
  const logger = container.get<LoggerService>('logger')
  const template = container.get<TemplateService>('template')
  const database = container.get<DatabaseService>('database')
  const server = container.get<ServerService>('server')

  // Only get available setup use cases for now
  const setupTableUseCase = container.get<SetupTableUseCase>('setupTableUseCase')
  const setupAutomationUseCase = container.get<SetupAutomationUseCase>('setupAutomationUseCase')
  const setupConnectionUseCase = container.get<SetupConnectionUseCase>('setupConnectionUseCase')
  const setupBucketUseCase = container.get<SetupBucketUseCase>('setupBucketUseCase')
  const handleConnectionErrorUseCase = container.get<HandleConnectionErrorUseCase>(
    'handleConnectionErrorUseCase'
  )

  // Create repositories (get auth service from container)
  const auth = container.get<AuthService>('authService')

  const appRepository = new AppRepository(env, logger, database, auth, server, template)
  const automationRepository = container.get<AutomationRepository>('automationRepository')
  const connectionRepository = container.get<ConnectionRepository>('connectionRepository')

  // Create use cases
  const validateUseCase = new ValidateAppUseCase(appRepository)
  const getAppMetadataUseCase = new GetAppMetadataUseCase()
  // Temporarily create a mock automation repository for GetAdminMetadataUseCase
  const getAdminMetadataUseCase = new GetAdminMetadataUseCase(automationRepository)

  const startUseCase = new StartAppUseCase(
    appRepository,
    setupAutomationUseCase,
    setupTableUseCase,
    setupConnectionUseCase,
    validateUseCase,
    setupBucketUseCase,
    handleConnectionErrorUseCase,
    connectionRepository,
    container
  )

  // Create context
  const context = new AppHonoContext(getAppMetadataUseCase, getAdminMetadataUseCase)

  return {
    repositories: {
      app: appRepository,
    },
    useCases: {
      validate: validateUseCase,
      getAppMetadata: getAppMetadataUseCase,
      getAdminMetadata: getAdminMetadataUseCase,
      start: startUseCase,
    },
    context,
  }
}
