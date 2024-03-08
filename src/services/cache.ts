import { RedisKey, RedisValue } from 'ioredis'

import { EnvService } from '@diia-inhouse/env'
import { HealthCheckResult, HttpStatusCode, Logger, OnHealthCheck } from '@diia-inhouse/types'

import { CacheProvider, CacheStatusResult } from '../interfaces/cache'
import { CacheStatus, RedisConfig, RedisStatusValue } from '../interfaces/redis'

import { RedisCacheProvider } from './providers/cache'

/**
 * @deprecated StoreService class should be used instead of this one
 */
export class CacheService implements OnHealthCheck {
    private readonly defaultExpiration: number = 60 * 60 * 3 // 3 hours

    private readonly provider: CacheProvider

    constructor(
        private readonly redisConfig: RedisConfig,

        private readonly envService: EnvService,
        private readonly logger: Logger,
    ) {
        this.provider = new RedisCacheProvider(this.redisConfig, logger)
    }

    async get(key: RedisKey): Promise<string | null> {
        const mappedKey: string = this.addPrefix(key)

        try {
            const result: string | null = await this.provider.get(mappedKey)

            return result
        } catch (err) {
            this.logger.error('Failed to get cached value from a provider', { err })

            throw err
        }
    }

    async set(key: RedisKey, data: RedisValue, expiration: number = this.defaultExpiration): Promise<string> {
        const mappedKey: string = this.addPrefix(key)
        const result: string = await this.provider.set(mappedKey, data, expiration)

        return result
    }

    async getKeysByPattern(pattern: string): Promise<string[]> {
        return await this.provider.getKeysByPattern(this.addPrefix(pattern))
    }

    async getByKeys(keys: string[]): Promise<(string | null)[]> {
        try {
            return await this.provider.getByKeys(keys)
        } catch (err) {
            this.logger.error('Failed to get cached value from a provider by keys', { err })

            throw err
        }
    }

    async remove(key: string): Promise<number> {
        const result: number = await this.provider.remove(this.addPrefix(key))

        return result
    }

    async onHealthCheck(): Promise<HealthCheckResult<CacheStatusResult>> {
        const cacheStatus: CacheStatus = this.provider.getStatus()

        const status: HttpStatusCode = Object.values(cacheStatus).some((s) => s !== RedisStatusValue.Ready)
            ? HttpStatusCode.SERVICE_UNAVAILABLE
            : HttpStatusCode.OK

        return {
            status,
            details: { redis: cacheStatus },
        }
    }

    private addPrefix(key: RedisKey): string {
        if (this.envService.isTest()) {
            return `test.${key}`
        }

        return key.toString()
    }
}
