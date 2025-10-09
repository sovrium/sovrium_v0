import type { Connection } from '../../domain/entity/connection.entity'
import type { IConnectionRepository } from '../../domain/repository-interface/connection-repository.interface'
import type { IAutomationRepository } from '../../../automation/domain/repository-interface/automation-repository.interface'
import type { App } from '../../../app/domain/entity/app.entity'

export class HandleConnectionErrorUseCase {
  constructor(
    private readonly connectionRepository: IConnectionRepository,

    private readonly automationRepository: IAutomationRepository
  ) {}

  async execute(app: App, connection: Connection, error: Error): Promise<void> {
    const errorMessage = error.message || 'Unknown error'

    this.connectionRepository.error(
      `Connection "${connection.name}" (${connection.service}) failed: ${errorMessage}`
    )

    // Disconnect the connection
    await this.connectionRepository.status.setConnected(connection.id, false)
    this.connectionRepository.debug(`Disconnected connection "${connection.name}"`)

    // Find all automations using this connection
    const affectedAutomations = app.findAutomationsByConnection(connection.id)

    // Deactivate affected automations
    for (const automation of affectedAutomations) {
      await this.automationRepository.status.setActive(automation.schema.id, false)
      this.automationRepository.debug(
        `Deactivated automation "${automation.schema.name}" (uses connection "${connection.name}")`
      )
    }

    // Send comprehensive alert email
    await this.sendAlertEmail(connection, affectedAutomations, errorMessage)
  }

  private async sendAlertEmail(
    connection: Connection,
    _affectedAutomations: Array<{ schema: { name: string; id: number } }>,
    _errorMessage: string
  ): Promise<void> {
    this.connectionRepository.debug(`Sending alert email for connection "${connection.name}"`)
    await this.connectionRepository.sendDisconnectedEmail(connection)

    // Note: The sendDisconnectedEmail already sends an email with basic info
    // In the future, we could enhance ConnectionRepository.sendDisconnectedEmail
    // to accept additional parameters for affected automations and error details
  }
}
