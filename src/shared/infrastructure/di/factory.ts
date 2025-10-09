// Third-party imports
import type { Hono } from 'hono'

// DI Infrastructure
import { SimpleContainer } from './simple-container'
import { HonoContext } from './context'

// Shared services
import { EnvService } from '../service/env.service'
import { LoggerService } from '../service/logger.service'
import { ServerService, type HonoType } from '../service/server.service'
import { DatabaseService } from '../service/database.service'
import { SchemaService } from '../service/validator.service'
import { TemplateService } from '../service/template.service'
import { EmailService } from '../service/email.service'
import { DomainEventPublisherService } from '../service/domain-event-publisher.service'
import { HttpService } from '../service/http.service'
import { IntegrationService } from '../service/integration.service'
import { AirtableAntiCorruptionLayer } from '../../domain/anti-corruption/airtable-anti-corruption-layer'
import { GoogleSheetsAntiCorruptionLayer } from '../../domain/anti-corruption/google-sheets-anti-corruption-layer'

// Domain types
import type { App } from '../../../features/app/domain/entity/app.entity'

// Core feature factories (no circular dependencies)
import { createUserServices } from '../../../features/user/infrastructure/factory'
import {
  createConnectionServices,
  createHandleConnectionErrorUseCase,
} from '../../../features/connection/infrastructure/factory'
import { createBucketServices } from '../../../features/bucket/infrastructure/factory'
import { createTableServices } from '../../../features/table/infrastructure/factory'
import { createRunServices } from '../../../features/run/infrastructure/factory'
import { createFormServices } from '../../../features/form/infrastructure/factory'

// Complex feature factories (with dependencies)
import { createActionServices } from '../../../features/action/infrastructure/factory'
import { createTriggerServices } from '../../../features/trigger/infrastructure/factory'
import {
  createAutomationServices,
  createAutomationRepository,
} from '../../../features/automation/infrastructure/factory'
import { createAppServices } from '../../../features/app/infrastructure/factory'

export interface AllServices {
  // Shared services
  env: EnvService
  logger: LoggerService
  server: ServerService
  database: DatabaseService
  validator: SchemaService
  template: TemplateService
  email: EmailService
  eventPublisher: DomainEventPublisherService
  httpService: HttpService
  integrationService: IntegrationService
  airtableACL: AirtableAntiCorruptionLayer
  googleSheetsACL: GoogleSheetsAntiCorruptionLayer
  honoContext: HonoContext

  // Feature services
  table: ReturnType<typeof createTableServices>
  automation: ReturnType<typeof createAutomationServices>
  action: ReturnType<typeof createActionServices>
  connection: ReturnType<typeof createConnectionServices>
  bucket: ReturnType<typeof createBucketServices>
  run: ReturnType<typeof createRunServices>
  trigger: ReturnType<typeof createTriggerServices>
  app: ReturnType<typeof createAppServices>
  form: ReturnType<typeof createFormServices>
  user: ReturnType<typeof createUserServices>
}

/**
 * Create and initialize all shared infrastructure services
 */
async function createSharedServices(container: SimpleContainer, apiRoutes: Hono<HonoType>) {
  // Create services
  const env = new EnvService()
  await env.load()

  const logger = new LoggerService(env)
  const database = new DatabaseService(env, logger)
  const validator = new SchemaService()
  const template = new TemplateService(logger, env)
  const email = new EmailService(env)
  const eventPublisher = new DomainEventPublisherService()
  const httpService = new HttpService()
  const server = new ServerService(env, logger, apiRoutes)

  // Create anti-corruption layers
  const airtableACL = new AirtableAntiCorruptionLayer(logger)
  const googleSheetsACL = new GoogleSheetsAntiCorruptionLayer(logger)

  // Register in container for feature factories
  container.set('env', env)
  container.set('logger', logger)
  container.set('server', server)
  container.set('database', database)
  container.set('validator', validator)
  container.set('template', template)
  container.set('email', email)
  container.set('eventPublisher', eventPublisher)
  container.set('httpService', httpService)
  container.set('airtableACL', airtableACL)
  container.set('googleSheetsACL', googleSheetsACL)

  return {
    env,
    logger,
    database,
    validator,
    template,
    email,
    eventPublisher,
    httpService,
    server,
    airtableACL,
    googleSheetsACL,
  }
}

/**
 * Create core feature services that have no circular dependencies
 */
function createCoreFeatureServices(container: SimpleContainer) {
  const user = createUserServices(container)
  const connection = createConnectionServices(container)
  const bucket = createBucketServices(container)
  const table = createTableServices(container)
  const run = createRunServices(container)
  const form = createFormServices(container)

  return { user, connection, bucket, table, run, form }
}

/**
 * Create complex feature services with interdependencies
 * These must be created in a specific order to resolve circular dependencies
 */
function createComplexFeatureServices(
  container: SimpleContainer,
  externals: Record<string, unknown>
) {
  // Step 1: Create automation repository first (needed by trigger and connection error handler)
  createAutomationRepository(container)

  // Step 2: Create HandleConnectionErrorUseCase now that automation repository is available
  createHandleConnectionErrorUseCase(container)

  // Step 3: Create integration service will be created after we have action services

  // Step 4: Create action and trigger services (can access automationRepository)
  const action = createActionServices(container, externals)
  const trigger = createTriggerServices(container)

  // Step 5: Create automation services (can access setupTriggerUseCase and setupActionUseCase)
  const automation = createAutomationServices(container)

  return { action, trigger, automation }
}

/**
 * Prepare dependencies for app service creation
 */
function prepareAppDependencies(
  container: SimpleContainer,
  coreServices: ReturnType<typeof createCoreFeatureServices>
) {
  // Store required services for app
  container.set('authService', coreServices.user.services.auth)
  container.set('setupTableUseCase', coreServices.table.useCases.setup)
}

/**
 * Create the global Hono context with all feature contexts
 */
function createGlobalContext(
  sharedServices: Awaited<ReturnType<typeof createSharedServices>>,
  coreServices: ReturnType<typeof createCoreFeatureServices>,
  complexServices: ReturnType<typeof createComplexFeatureServices>,
  app: ReturnType<typeof createAppServices>
) {
  return new HonoContext(
    sharedServices.server,
    sharedServices.env,
    sharedServices.logger,
    app.context,
    coreServices.user.context,
    complexServices.automation.context,
    coreServices.connection.context,
    coreServices.form.context,
    coreServices.run.context,
    coreServices.table.context,
    complexServices.trigger.context,
    coreServices.bucket.context
  )
}

/**
 * Setup app context integration with Hono context
 */
function setupAppContextIntegration(container: SimpleContainer, honoContext: HonoContext) {
  const setupAppContext = (app: App) => {
    honoContext.setVariables(app)
  }

  container.set('setupAppContext', setupAppContext)
}

/**
 * Main factory function to create all services in the correct dependency order
 */
export async function createAllServices(
  externals: Record<string, unknown> = {},
  apiRoutes: Hono<HonoType>
): Promise<AllServices> {
  const container = new SimpleContainer()

  // Phase 1: Create shared infrastructure services
  const sharedServices = await createSharedServices(container, apiRoutes)

  // Phase 2: Create core feature services (no circular dependencies)
  const coreServices = createCoreFeatureServices(container)

  // Phase 3: Create complex feature services (with interdependencies)
  const complexServices = createComplexFeatureServices(container, externals)

  // Phase 4: Prepare and create app services
  prepareAppDependencies(container, coreServices)
  const app = createAppServices(container)

  // Phase 5: Create global Hono context
  const honoContext = createGlobalContext(sharedServices, coreServices, complexServices, app)

  // Phase 6: Setup app context integration
  setupAppContextIntegration(container, honoContext)

  // Create a placeholder integration service for now
  const integrationService = sharedServices.httpService as unknown as IntegrationService

  return {
    // Shared services
    ...sharedServices,
    integrationService,
    honoContext,

    // Feature services
    ...coreServices,
    ...complexServices,
    app,
  }
}
