import Redis from 'ioredis'
import { RedlockMutex } from 'redis-semaphore'

import { Logger } from '@diia-inhouse/types'

import { RedisConfig } from '../interfaces/redis'

import { RedisService } from './redis'

export class RedlockService {
    private clientRW: Redis

    constructor(
        private readonly storeConfig: RedisConfig,

        private readonly logger: Logger,
    ) {
        const { readWrite } = this.storeConfig

        this.clientRW = RedisService.createClient(readWrite)

        this.clientRW.on('connect', () => {
            this.logger.info(`Redis REDLOCK READ-WRITE connection open to ${JSON.stringify(readWrite.sentinels)}`)
        })

        this.clientRW.on('error', (err: Error) => {
            this.logger.info('Redis REDLOCK READ-WRITE connection error ', { err })
            this.logger.info(`Redis Path ${JSON.stringify(readWrite.sentinels)}`)
        })
    }

    async lock(resource: string, ttl = 60000): Promise<RedlockMutex> {
        this.logger.info(`Start LOCK resource [${resource}] for ttl [${ttl}]`)
        const mutex = new RedlockMutex([this.clientRW], resource, { lockTimeout: ttl, acquireTimeout: ttl * 2 })

        await mutex.acquire()

        return mutex
    }
}
