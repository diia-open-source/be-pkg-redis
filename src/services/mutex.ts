import { Redis } from 'ioredis'
import { RedlockMutex } from 'redis-semaphore'

import { HealthCheckResult, HttpStatusCode, Logger, OnDestroy, OnHealthCheck } from '@diia-inhouse/types'

import { LockOptions, MutexStatusResult } from '../interfaces/index.js'
import { RedisConfig, RedisMode, RedisStatusValue } from '../interfaces/redis.js'
import { RedisService } from './redis.js'

export class RedlockService implements OnHealthCheck, OnDestroy {
    private clientRW: Redis

    constructor(
        private readonly storeConfig: RedisConfig,

        private readonly logger: Logger,
    ) {
        const { readWrite } = this.storeConfig

        this.clientRW = RedisService.createClient({ ...readWrite, redisMode: RedisMode.ReadWrite }, this.logger)

        this.clientRW.on('connect', () => {
            const { host, port, sentinels } = readWrite

            this.logger.info('Redis REDLOCK READ-WRITE connection open', { host, port, sentinels })
        })

        this.clientRW.on('error', (err: Error) => {
            this.logger.error('Redis REDLOCK READ-WRITE connection error ', { err })
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

    async lock(resource: string, ttl = 60000, options: LockOptions = {}): Promise<RedlockMutex> {
        const mutex = this.createMutex(resource, ttl, options)

        await mutex.acquire()

        return mutex
    }

    /**
     * Same as `lock`, but resolves with `null` instead of throwing when the resource is not acquired within `acquireTimeout`
     */
    async tryLock(resource: string, ttl = 60000, options: LockOptions = {}): Promise<RedlockMutex | null> {
        const mutex = this.createMutex(resource, ttl, options)

        return (await mutex.tryAcquire()) ? mutex : null
    }

    private createMutex(resource: string, ttl: number, { retryInterval = 500, acquireTimeout = ttl * 2 }: LockOptions): RedlockMutex {
        this.logger.info(`Start LOCK resource [${resource}] for ttl [${ttl}]ms`)

        return new RedlockMutex([this.clientRW], resource, { lockTimeout: ttl, acquireTimeout, retryInterval })
    }
}
