const redlockMock = {
    constructor: jest.fn(),
    acquire: jest.fn(),
}

const redisClientRwMock = {
    on: jest.fn(),
}

const RedisServiceMock = {
    createClient: jest.fn(),
}

class RedlockMutexMock {
    constructor(...args: unknown[]) {
        redlockMock.constructor(...args)
    }

    acquire(...args: unknown[]): unknown {
        return redlockMock.acquire(...args)
    }
}

jest.mock('redis-semaphore', () => ({ RedlockMutex: RedlockMutexMock }))
jest.mock('@services/redis', () => ({ RedisService: RedisServiceMock }))

import Logger from '@diia-inhouse/diia-logger'
import { mockClass } from '@diia-inhouse/test'

import { RedlockService } from '../../../src/index'
import { config } from '../../mocks/services/redlock'

const LoggerMock = mockClass(Logger)

describe('RedlockService', () => {
    const logger = new LoggerMock()

    describe('event handlers', () => {
        it('should properly react on different events', () => {
            const expectedRedisError = new Error('Unable to instantiate redis client')

            RedisServiceMock.createClient.mockReturnValue(redisClientRwMock)

            redisClientRwMock.on.mockImplementationOnce((_event, cb) => {
                cb()
            })

            redisClientRwMock.on.mockImplementationOnce((_event, cb) => {
                cb(expectedRedisError)
            })

            new RedlockService(config, logger)

            expect(logger.info).toHaveBeenCalledWith(
                `Redis REDLOCK READ-WRITE connection open to ${JSON.stringify(config.readWrite.sentinels)}`,
            )
            expect(logger.info).toHaveBeenCalledWith('Redis REDLOCK READ-WRITE connection error ', { err: expectedRedisError })
            expect(logger.info).toHaveBeenCalledWith(`Redis Path ${JSON.stringify(config.readWrite.sentinels)}`)
        })
    })

    describe('method: `lock`', () => {
        it('should lock resource with provided ttl', async () => {
            const resource = 'resource'
            const ttl = 1800

            RedisServiceMock.createClient.mockReturnValue(redisClientRwMock)
            redlockMock.acquire.mockResolvedValue({})

            const redlockService = new RedlockService(config, logger)

            expect(await redlockService.lock(resource, ttl)).toEqual({})
            expect(redlockMock.constructor).toHaveBeenCalledWith([redisClientRwMock], resource, {
                acquireTimeout: 3600,
                lockTimeout: 1800,
            })
            expect(redlockMock.acquire).toHaveBeenCalled()
            expect(logger.info).toHaveBeenCalledWith(`Start LOCK resource [${resource}] for ttl [${ttl}]`)
        })

        it('should lock resource with default ttl', async () => {
            const resource = 'resource'
            const defaultTtl = 60000

            RedisServiceMock.createClient.mockReturnValue(redisClientRwMock)
            redlockMock.acquire.mockResolvedValue({})

            const redlockService = new RedlockService(config, logger)

            expect(await redlockService.lock(resource)).toEqual({})
            expect(redlockMock.constructor).toHaveBeenCalledWith([redisClientRwMock], resource, {
                acquireTimeout: 120_000,
                lockTimeout: 60_000,
            })
            expect(redlockMock.acquire).toHaveBeenCalled()
            expect(logger.info).toHaveBeenCalledWith(`Start LOCK resource [${resource}] for ttl [${defaultTtl}]`)
        })
    })
})
