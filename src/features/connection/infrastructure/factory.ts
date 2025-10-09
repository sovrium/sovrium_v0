import { SimpleContainer } from '../../../shared/infrastructure/di/simple-container'
import type { LoggerService } from '../../../shared/infrastructure/service/logger.service'
import type { EnvService } from '../../../shared/infrastructure/service/env.service'
import type { EmailService } from '../../../shared/infrastructure/service/email.service'
import type { DatabaseService } from '../../../shared/infrastructure/service/database.service'

// Infrastructure
import { ConnectionRepository } from './repository/connection.repository'
import { TokenRepository } from './repository/token.repository'
import { ConnectionDatabaseService } from './service/database.service'

// Use Cases
import { SetupConnectionUseCase } from '../application/use-case/setup-connection.use-case'
import { DisconnectConnectionUseCase } from '../application/use-case/disconnect-connection.use-case'
import { ListConnectionsUseCase } from '../application/use-case/list-connections.use-case'
import { AuthenticateConnectionUseCase } from '../application/use-case/authenticate-connection.use-case'
import { HandleConnectionErrorUseCase } from '../application/use-case/handle-connection-error.use-case'

// Dependencies
import type { IAutomationRepository } from '../../automation/domain/repository-interface/automation-repository.interface'

// Context
import { ConnectionHonoContext } from './di/context'

export interface ConnectionServices {
  repositories: {
    connection: ConnectionRepository
    token: TokenRepository
  }
  useCases: {
    setup: SetupConnectionUseCase
    disconnect: DisconnectConnectionUseCase
    list: ListConnectionsUseCase
    authenticate: AuthenticateConnectionUseCase
  }
  services: {
    database: ConnectionDatabaseService
  }
  context: ConnectionHonoContext
}

export function createConnectionServices(container: SimpleContainer): ConnectionServices {
  // Get shared services from container
  const logger = container.get<LoggerService>('logger')
  const env = container.get<EnvService>('env')
  const email = container.get<EmailService>('email')
  const database = container.get<DatabaseService>('database')

  // Create database service
  const connectionDatabase = new ConnectionDatabaseService(database)

  // Create repositories
  const connectionRepository = new ConnectionRepository(logger, connectionDatabase, env, email)
  const tokenRepository = new TokenRepository(connectionDatabase, connectionRepository)

  // Create use cases
  const setupUseCase = new SetupConnectionUseCase(connectionRepository, tokenRepository)
  const disconnectUseCase = new DisconnectConnectionUseCase(connectionRepository)
  const listUseCase = new ListConnectionsUseCase(connectionRepository)
  const authenticateUseCase = new AuthenticateConnectionUseCase(
    connectionRepository,
    tokenRepository
  )

  // Create context
  const context = new ConnectionHonoContext(listUseCase, authenticateUseCase, disconnectUseCase)

  // Store in container for other features
  container.set('connectionRepository', connectionRepository)
  container.set('tokenRepository', tokenRepository)
  container.set('setupConnectionUseCase', setupUseCase)

  return {
    repositories: {
      connection: connectionRepository,
      token: tokenRepository,
    },
    useCases: {
      setup: setupUseCase,
      disconnect: disconnectUseCase,
      list: listUseCase,
      authenticate: authenticateUseCase,
    },
    services: {
      database: connectionDatabase,
    },
    context,
  }
}

/**
 * Create HandleConnectionErrorUseCase after automation repository is available
 * This must be called in Phase 3 of DI initialization
 */
export function createHandleConnectionErrorUseCase(container: SimpleContainer): HandleConnectionErrorUseCase {
  const connectionRepository = container.get<ConnectionRepository>('connectionRepository')
  const automationRepository = container.get<IAutomationRepository>('automationRepository')

  const handleErrorUseCase = new HandleConnectionErrorUseCase(
    connectionRepository,
    automationRepository
  )

  container.set('handleConnectionErrorUseCase', handleErrorUseCase)

  return handleErrorUseCase
}
