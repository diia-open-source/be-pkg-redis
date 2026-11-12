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

const withoutJitter = (): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
}

describe('RedisService', () => {
    let loggerMock: Logger

    beforeEach(() => {
        loggerMock = mock<Logger>()
    })

    describe('method: `createClient`', () => {
        it('should successfully create redis client with logger', () => {
            // Act
            const client = RedisService.createClient({}, loggerMock)

            // Assert
            expect(client.options).toBeDefined()
            expect(client.options.enableAutoPipelining).toBe(true)
            expect(client.options.reconnectOnError).toBeInstanceOf(Function)
            expect(client.options.retryStrategy).toBeInstanceOf(Function)
        })

        it('should configure exponential backoff starting at 1 second', () => {
            // Arrange
            const options = {}

            withoutJitter()

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

            withoutJitter()

            // Act
            const client = RedisService.createClient(options, loggerMock) as MockRedisClient
            const retryStrategy = client.options.retryStrategy!

            // Assert
            expect(retryStrategy(1)).toBe(1000)
            expect(retryStrategy(2)).toBe(2000)
            expect(retryStrategy(3)).toBe(4000)
            expect(retryStrategy(4)).toBe(8000)
        })

        it('should cap maximum retry delay at 10 seconds', () => {
            // Arrange
            const options = {}

            withoutJitter()

            // Act
            const client = RedisService.createClient(options, loggerMock) as MockRedisClient
            const retryStrategy = client.options.retryStrategy!

            // Assert
            expect(retryStrategy(10)).toBe(DurationMs.Second * 10)
        })

        it('should jitter every retry delay between one and two times its backoff', () => {
            // Arrange
            const options = {}
            const backoffByAttempt = [
                [1, DurationMs.Second],
                [2, DurationMs.Second * 2],
                [5, DurationMs.Second * 10],
                [11, DurationMs.Second * 10],
                [1000, DurationMs.Second * 10],
            ]

            // Act
            const client = RedisService.createClient(options, loggerMock) as MockRedisClient
            const retryStrategy = client.options.retryStrategy!

            // Assert
            for (const [attempts, backoff] of backoffByAttempt) {
                const delays = Array.from({ length: 100 }, () => retryStrategy(attempts)!)

                for (const delay of delays) {
                    expect(delay).toBeGreaterThanOrEqual(backoff)
                    expect(delay).toBeLessThanOrEqual(backoff * 2)
                }

                expect(new Set(delays).size).toBeGreaterThan(1)
            }
        })

        it('should rate limit the exhausted retry log to the first and every 20th attempt', () => {
            // Arrange
            const options = {}

            withoutJitter()

            // Act
            const client = RedisService.createClient(options, loggerMock) as MockRedisClient
            const retryStrategy = client.options.retryStrategy!

            retryStrategy(11)

            // Assert
            expect(loggerMock.error).toHaveBeenCalledWith('Redis connection failed after 11 attempts. Retrying in 10000ms...', {
                host: undefined,
                port: undefined,
                redisMode: undefined,
            })

            vi.mocked(loggerMock.error).mockClear()

            for (let attempts = 12; attempts < 20; attempts += 1) {
                retryStrategy(attempts)
            }

            expect(loggerMock.error).not.toHaveBeenCalled()

            retryStrategy(20)

            expect(loggerMock.error).toHaveBeenCalledTimes(1)
        })
    })
})
