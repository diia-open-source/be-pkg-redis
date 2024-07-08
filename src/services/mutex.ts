import Redis from 'ioredis'
import { RedlockMutex } from 'redis-semaphore'

import { HealthCheckResult, HttpStatusCode, Logger, OnDestroy, OnHealthCheck } from '@diia-inhouse/types'

import { MutexStatusResult } from '../interfaces'
import { RedisConfig, RedisStatusValue } from '../interfaces/redis'

import { RedisService } from './redis'

export class RedlockService implements OnHealthCheck, OnDestroy {
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

    async onHealthCheck(): Promise<HealthCheckResult<MutexStatusResult>> {
        const cacheStatus = this.clientRW.status
        const status = cacheStatus === RedisStatusValue.Ready ? HttpStatusCode.OK : HttpStatusCode.SERVICE_UNAVAILABLE

        return {
            status,
            details: { mutex: cacheStatus },
        }
    }

    async onDestroy(): Promise<void> {
        await this.clientRW.quit()
    }

    async lock(resource: string, ttl = 60000): Promise<RedlockMutex> {
        this.logger.info(`Start LOCK resource [${resource}] for ttl [${ttl}]`)
        const mutex = new RedlockMutex([this.clientRW], resource, { lockTimeout: ttl, acquireTimeout: ttl * 2 })

        await mutex.acquire()

        return mutex
    }
}
