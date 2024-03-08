const redisCacheProviderMock = {
    get: jest.fn(),
    set: jest.fn(),
    getKeysByPattern: jest.fn(),
    getByKeys: jest.fn(),
    remove: jest.fn(),
    getStatus: jest.fn(),
}

class RedisCacheProviderMock {
    get(...args: unknown[]): unknown {
        return redisCacheProviderMock.get(...args)
    }

    set(...args: unknown[]): unknown {
        return redisCacheProviderMock.set(...args)
    }

    getKeysByPattern(...args: unknown[]): unknown {
        return redisCacheProviderMock.getKeysByPattern(...args)
    }

    getByKeys(...args: unknown[]): unknown {
        return redisCacheProviderMock.getByKeys(...args)
    }

    remove(...args: unknown[]): unknown {
        return redisCacheProviderMock.remove(...args)
    }

    getStatus(...args: unknown[]): unknown {
        return redisCacheProviderMock.getStatus(...args)
    }
}

jest.mock('@services/providers/cache', () => ({ RedisCacheProvider: RedisCacheProviderMock }))

import Logger from '@diia-inhouse/diia-logger'
import { EnvService } from '@diia-inhouse/env'
import { mockClass } from '@diia-inhouse/test'
import { HttpStatusCode } from '@diia-inhouse/types'

import { CacheService, CacheStatus, RedisStatusValue } from '../../../src/index'
import { generateUuid } from '../../mocks/randomData'
import { config } from '../../mocks/services/cache'

const LoggerMock = mockClass(Logger)
const EnvServiceMock = mockClass(EnvService)

describe('CacheService', () => {
    const logger = new LoggerMock()
    const envService = new EnvServiceMock()
    const cacheService = new CacheService(config, envService, logger)

    describe('method: `get`', () => {
        it('should successfully get item from cache', async () => {
            const key = generateUuid()
            const expectedValue = 'value'

            redisCacheProviderMock.get.mockResolvedValue(expectedValue)
            jest.spyOn(envService, 'isTest').mockReturnValue(false)

            expect(await cacheService.get(key)).toEqual(expectedValue)
            expect(redisCacheProviderMock.get).toHaveBeenCalledWith(key)
        })

        it('should fail to get item from cache in case there is error occured', async () => {
            const key = generateUuid()
            const expectedError = new Error('Unable to get item from cache')

            redisCacheProviderMock.get.mockRejectedValue(expectedError)
            jest.spyOn(envService, 'isTest').mockReturnValue(true)

            await expect(async () => {
                await cacheService.get(key)
            }).rejects.toEqual(expectedError)

            expect(logger.error).toHaveBeenCalledWith('Failed to get cached value from a provider', { err: expectedError })
            expect(redisCacheProviderMock.get).toHaveBeenCalledWith(`test.${key}`)
        })
    })

    describe('method: `set`', () => {
        it('should successfully set value in cache with provided expiration', async () => {
            const key = generateUuid()
            const value = 'value'
            const expiration = 1800

            redisCacheProviderMock.set.mockResolvedValue('OK')
            jest.spyOn(envService, 'isTest').mockReturnValue(false)

            expect(await cacheService.set(key, value, expiration)).toBe('OK')
            expect(redisCacheProviderMock.set).toHaveBeenCalledWith(key, value, expiration)
        })

        it('should successfully set value in cache with default expiration', async () => {
            const key = generateUuid()
            const value = 'value'
            const expiration = 60 * 60 * 3

            redisCacheProviderMock.set.mockResolvedValue('OK')
            jest.spyOn(envService, 'isTest').mockReturnValue(false)

            expect(await cacheService.set(key, value)).toBe('OK')
            expect(redisCacheProviderMock.set).toHaveBeenCalledWith(key, value, expiration)
        })
    })

    describe('method: `getKeysByPattern`', () => {
        it('should successfully get item from cache', async () => {
            const pattern = '*'
            const expectedValue = ['key']

            redisCacheProviderMock.getKeysByPattern.mockResolvedValue(expectedValue)
            jest.spyOn(envService, 'isTest').mockReturnValue(false)

            expect(await cacheService.getKeysByPattern(pattern)).toEqual(expectedValue)
            expect(redisCacheProviderMock.getKeysByPattern).toHaveBeenCalledWith(pattern)
        })
    })

    describe('method: `getByKeys`', () => {
        it('should successfully get list of items from cache by keys', async () => {
            const keys = [generateUuid()]
            const expectedValues = ['value']

            redisCacheProviderMock.getByKeys.mockResolvedValue(expectedValues)
            jest.spyOn(envService, 'isTest').mockReturnValue(false)

            expect(await cacheService.getByKeys(keys)).toEqual(expectedValues)
            expect(redisCacheProviderMock.getByKeys).toHaveBeenCalledWith(keys)
        })

        it('should fail to get list of items from cache in case there is error occured', async () => {
            const keys = [generateUuid()]
            const expectedError = new Error('Unable to get items from cache')

            redisCacheProviderMock.getByKeys.mockRejectedValue(expectedError)
            jest.spyOn(envService, 'isTest').mockReturnValue(true)

            await expect(async () => {
                await cacheService.getByKeys(keys)
            }).rejects.toEqual(expectedError)

            expect(logger.error).toHaveBeenCalledWith('Failed to get cached value from a provider by keys', { err: expectedError })
            expect(redisCacheProviderMock.getByKeys).toHaveBeenCalledWith(keys)
        })
    })

    describe('method: `remove`', () => {
        it('should successfully remove value from cache', async () => {
            const key = generateUuid()

            redisCacheProviderMock.remove.mockResolvedValue(1)
            jest.spyOn(envService, 'isTest').mockReturnValue(false)

            expect(await cacheService.remove(key)).toBe(1)
            expect(redisCacheProviderMock.remove).toHaveBeenCalledWith(key)
        })
    })

    describe('method: `onHealthCheck`', () => {
        it.each([
            [
                'OK',
                {
                    status: HttpStatusCode.OK,
                    details: { redis: <CacheStatus>{ readOnly: RedisStatusValue.Ready, readWrite: RedisStatusValue.Ready } },
                },
            ],
            [
                'SERVICE UNAVAILABLE',
                {
                    status: HttpStatusCode.SERVICE_UNAVAILABLE,
                    details: { redis: <CacheStatus>{ readOnly: <RedisStatusValue>'connecting', readWrite: RedisStatusValue.Ready } },
                },
            ],
        ])('should return `%s` status', async (_httpStatus, expectedStatus) => {
            redisCacheProviderMock.getStatus.mockReturnValue(expectedStatus.details.redis)

            expect(await cacheService.onHealthCheck()).toEqual(expectedStatus)
        })
    })
})
