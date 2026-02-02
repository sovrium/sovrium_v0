import type { IAntiCorruptionLayer } from './anti-corruption-layer.interface'
// eslint-disable-next-line boundaries/element-types
import type { LoggerService } from '../../infrastructure/service/logger.service'

/**
 * Base class for anti-corruption layers providing common functionality
 */
export abstract class BaseAntiCorruptionLayer<TExternal, TDomain> implements IAntiCorruptionLayer<
  TExternal,
  TDomain
> {
  constructor(protected readonly logger: LoggerService) {}

  abstract toDomain(external: TExternal): TDomain
  abstract toExternal(domain: TDomain): TExternal
  abstract validateExternal(data: unknown): data is TExternal
  abstract getServiceInfo(): { name: string; version: string }

  /**
   * Safe transformation with error handling and logging
   */
  safeToDomain(external: unknown): TDomain | null {
    try {
      if (!this.validateExternal(external)) {
        this.logger.error(
          `Invalid external data structure for ${this.getServiceInfo().name}: ${JSON.stringify(external)}`
        )
        return null
      }

      return this.toDomain(external)
    } catch (error) {
      this.logger.error(
        `Failed to transform external data to domain for ${this.getServiceInfo().name}: ${error instanceof Error ? error.message : String(error)}`
      )
      return null
    }
  }

  /**
   * Safe transformation with error handling and logging
   */
  safeToExternal(domain: TDomain): TExternal | null {
    try {
      return this.toExternal(domain)
    } catch (error) {
      this.logger.error(
        `Failed to transform domain data to external for ${this.getServiceInfo().name}: ${error instanceof Error ? error.message : String(error)}`
      )
      return null
    }
  }
}
