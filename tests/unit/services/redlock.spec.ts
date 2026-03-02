/* eslint-disable @typescript-eslint/no-explicit-any */
import { Redis } from 'ioredis'
import { RedlockMutex } from 'redis-semaphore'
import { mock } from 'vitest-mock-extended'

import Logger from '@diia-inhouse/diia-logger'

import { RedlockService } from '../../../src/index'
import { RedisService } from '../../../src/services/redis'
import { config } from '../../mocks/services/redlock'

vi.mock('redis-semaphore', () => ({
    RedlockMutex: class RedlockMutexMock {
        acquire(): unknown {
            return vi.fn()
        }
    },
}))

const redisClientRwMock = {
    on: vi.fn(),
    set: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
    status: 'ready',
} as unknown as Redis

describe('RedlockService', () => {
    const logger = mock<Logger>()

    describe('event handlers', () => {
        it('should properly react on different events', () => {
            const expectedRedisError = new Error('Unable to instantiate redis client')

            vi.spyOn(RedisService, 'createClient').mockReturnValue(redisClientRwMock)

            vi.mocked(redisClientRwMock.on as any).mockImplementationOnce((_event: any, cb: any) => {
                cb()
            })

            vi.mocked(redisClientRwMock.on as any).mockImplementationOnce((_event: any, cb: any) => {
                cb(expectedRedisError)
            })

            new RedlockService(config, logger)

            expect(logger.info).toHaveBeenCalledWith('Redis REDLOCK READ-WRITE connection open', { sentinels: config.readWrite.sentinels })
            expect(logger.error).toHaveBeenCalledWith('Redis REDLOCK READ-WRITE connection error ', { err: expectedRedisError })
        })
    })

    describe('method: `lock`', () => {
        it('should lock resource with provided ttl', async () => {
            const resource = 'resource'
            const ttl = 1800

            vi.spyOn(RedisService, 'createClient').mockReturnValue(redisClientRwMock)
            vi.spyOn(RedlockMutex.prototype, 'acquire').mockResolvedValue()

            const redlockService = new RedlockService(config, logger)

            expect(await redlockService.lock(resource, ttl, { retryInterval: 1 })).toEqual({})

            expect(RedlockMutex.prototype.acquire).toHaveBeenCalled()
            expect(logger.info).toHaveBeenCalledWith(`Start LOCK resource [${resource}] for ttl [${ttl}]ms`)
        })

        it('should lock resource with default ttl', async () => {
            const resource = 'resource'
            const defaultTtl = 60000

            vi.spyOn(RedisService, 'createClient').mockReturnValue(redisClientRwMock)
            vi.spyOn(RedlockMutex.prototype, 'acquire').mockResolvedValue()

            const redlockService = new RedlockService(config, logger)

            expect(await redlockService.lock(resource)).toEqual({})

            expect(RedlockMutex.prototype.acquire).toHaveBeenCalled()
            expect(logger.info).toHaveBeenCalledWith(`Start LOCK resource [${resource}] for ttl [${defaultTtl}]ms`)
        })
    })
})
