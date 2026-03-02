import { Redis, RedisOptions } from 'ioredis'
import { mock } from 'vitest-mock-extended'

import { DurationMs, Logger } from '@diia-inhouse/types'

import { RedisService } from '../../../src/index'

vi.mock('ioredis', async (importOriginal) => {
    const original = await importOriginal<{ Redis: new (...args: unknown[]) => Redis }>()

    return { ...original, Redis: class RedisMock extends original.Redis {} }
})

interface MockRedisClient extends Redis {
    options: RedisOptions & {
        retryStrategy?: (attempts: number) => number | null
        reconnectOnError?: (err: Error) => boolean | number
    }
}

describe('RedisService', () => {
    let loggerMock: Logger

    beforeEach(() => {
        loggerMock = mock<Logger>()
        vi.clearAllMocks()
    })

    describe('method: `createClient`', () => {
        it('should successfully create redis client with logger', () => {
            // Act
            const client = RedisService.createClient({}, loggerMock as Logger)

            // Assert
            expect(client.options).toBeDefined()
            expect(client.options.enableAutoPipelining).toBe(true)
            expect(client.options.reconnectOnError).toBeInstanceOf(Function)
            expect(client.options.retryStrategy).toBeInstanceOf(Function)
        })

        it('should configure exponential backoff starting at 100ms', () => {
            // Arrange
            const options = {}

            // Act
            const client = RedisService.createClient(options, loggerMock) as MockRedisClient
            const retryStrategy = client.options.retryStrategy!

            // Assert
            expect(retryStrategy).toBeDefined()

            const firstRetryDelay = retryStrategy(1)

            expect(firstRetryDelay).toBe(1000)
        })

        it('should double retry interval on each attempt', () => {
            // Arrange
            const options = {}

            // Act
            const client = RedisService.createClient(options, loggerMock) as MockRedisClient
            const retryStrategy = client.options.retryStrategy!

            // Assert
            expect(retryStrategy(1)).toBe(1000)
            expect(retryStrategy(2)).toBe(2000)
            expect(retryStrategy(3)).toBe(4000)
            expect(retryStrategy(4)).toBe(8000)
        })

        it('should cap maximum retry delay at 30 seconds', () => {
            // Arrange
            const options = {}

            // Act
            const client = RedisService.createClient(options, loggerMock) as MockRedisClient
            const retryStrategy = client.options.retryStrategy!

            // Assert
            expect(retryStrategy(10)).toBe(DurationMs.Second * 10)
        })

        it('should stop retrying after 100 attempts', () => {
            // Arrange
            const options = {}

            // Act
            const client = RedisService.createClient(options, loggerMock) as MockRedisClient
            const retryStrategy = client.options.retryStrategy!

            // Assert
            expect(retryStrategy(11)).toBeNull()
            expect(loggerMock.error).toHaveBeenCalledWith('Redis connection failed after 10 attempts. Shutting down connection attempts.', {
                host: undefined,
                port: undefined,
                redisMode: undefined,
            })
        })
    })
})
