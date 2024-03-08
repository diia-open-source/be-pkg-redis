import Redis, { RedisKey, RedisValue } from 'ioredis'

import { Logger } from '@diia-inhouse/types'

import { CacheProvider } from '../../interfaces/cache'
import { CacheStatus, RedisConfig } from '../../interfaces/redis'
import { RedisService } from '../redis'

export class RedisCacheProvider implements CacheProvider {
    private clientRW: Redis

    private clientRO: Redis

    constructor(
        { readWrite, readOnly }: RedisConfig,

        private readonly logger: Logger,
    ) {
        this.clientRW = RedisService.createClient(readWrite)
        this.clientRO = RedisService.createClient(readOnly)

        this.clientRW.on('connect', () => {
            this.logger.info(`Redis READ-WRITE connection open to ${JSON.stringify(readWrite.sentinels)}`)
        })

        this.clientRW.on('error', (err: Error) => {
            this.logger.error('Redis READ-WRITE connection error ', { err })
        })

        this.clientRO.on('connect', () => {
            this.logger.info(`Redis READ-ONLY connection open to ${JSON.stringify(readOnly.sentinels)}`)
        })

        this.clientRO.on('error', (err: Error) => {
            this.logger.error('Redis READ-ONLY connection error ', { err })
        })
    }

    async get(key: string): Promise<string | null> {
        return await this.clientRO.get(key)
    }

    async set(key: RedisKey, data: RedisValue, expiration: number): Promise<string> {
        const result: string = await this.clientRW.set(key, data)
        if (expiration !== -1) {
            await this.clientRW.expire(key, expiration)
        }

        return result
    }

    async getKeysByPattern(pattern: string): Promise<string[]> {
        return await this.clientRO.keys(pattern)
    }

    async getByKeys(keys: string[]): Promise<(string | null)[]> {
        return await this.clientRO.mget(keys)
    }

    async remove(...key: string[]): Promise<number> {
        return await this.clientRW.del(...key)
    }

    getStatus(): CacheStatus {
        return {
            readWrite: this.clientRW.status,
            readOnly: this.clientRO.status,
        }
    }
}
