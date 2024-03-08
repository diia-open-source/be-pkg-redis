const redisClientRoMock = {
    on: jest.fn(),
    get: jest.fn(),
    keys: jest.fn(),
    mget: jest.fn(),
    status: 'ready',
}

const redisClientRwMock = {
    on: jest.fn(),
    set: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    status: 'ready',
}

const createClient = jest.fn()

class RedisServiceMock {
    static createClient = createClient
}

jest.mock('@services/redis', () => ({ RedisService: RedisServiceMock }))

import Logger from '@diia-inhouse/diia-logger'
import { mockClass } from '@diia-inhouse/test'

import { RedisCacheProvider } from '../../../../src/services/providers/cache'
import { config } from '../../../mocks/services/providers/cache'

const LoggerMock = mockClass(Logger)

describe('RedisCacheProvider', () => {
    describe('method: `get`', () => {
        it('shoudl successfully get item from cache', async () => {
            createClient.mockReturnValueOnce(redisClientRwMock)
            createClient.mockReturnValueOnce(redisClientRoMock)

            const expectedValue = 'value'
            const logger = new LoggerMock()
            const redisCacheProvider = new RedisCacheProvider(config, logger)

            redisClientRoMock.get.mockResolvedValue(expectedValue)

            expect(await redisCacheProvider.get('key')).toEqual(expectedValue)
            expect(redisClientRoMock.get).toHaveBeenCalledWith('key')
        })
    })

    describe('method: `set`', () => {
        it('should successfully set value with expiration in cache', async () => {
            createClient.mockReturnValueOnce(redisClientRwMock)
            createClient.mockReturnValueOnce(redisClientRoMock)

            const logger = new LoggerMock()
            const redisCacheProvider = new RedisCacheProvider(config, logger)

            redisClientRwMock.set.mockResolvedValue('OK')

            expect(await redisCacheProvider.set('key', 'value', 1800)).toBe('OK')
            expect(redisClientRwMock.set).toHaveBeenCalledWith('key', 'value')
            expect(redisClientRwMock.expire).toHaveBeenCalledWith('key', 1800)
        })
    })

    describe('method: `getKeysByPattern`', () => {
        it('shoudl successfully get keys list by pattern', async () => {
            createClient.mockReturnValueOnce(redisClientRwMock)
            createClient.mockReturnValueOnce(redisClientRoMock)

            const expectedKeys = ['key1', 'key2']
            const logger = new LoggerMock()
            const redisCacheProvider = new RedisCacheProvider(config, logger)

            redisClientRoMock.keys.mockResolvedValue(expectedKeys)

            expect(await redisCacheProvider.getKeysByPattern('*')).toEqual(expectedKeys)
            expect(redisClientRoMock.keys).toHaveBeenCalledWith('*')
        })
    })

    describe('method: `getByKeys`', () => {
        it('shoudl successfully get list of items', async () => {
            createClient.mockReturnValueOnce(redisClientRwMock)
            createClient.mockReturnValueOnce(redisClientRoMock)

            const expectedValues = ['value1', 'value2']
            const logger = new LoggerMock()
            const redisCacheProvider = new RedisCacheProvider(config, logger)

            redisClientRoMock.mget.mockResolvedValue(expectedValues)

            expect(await redisCacheProvider.getByKeys(['key1', 'key2'])).toEqual(expectedValues)
            expect(redisClientRoMock.mget).toHaveBeenCalledWith(['key1', 'key2'])
        })
    })

    describe('method: `remove`', () => {
        it('should successfully remove key from cache', async () => {
            createClient.mockReturnValueOnce(redisClientRwMock)
            createClient.mockReturnValueOnce(redisClientRoMock)

            const logger = new LoggerMock()
            const redisCacheProvider = new RedisCacheProvider(config, logger)

            redisClientRwMock.del.mockResolvedValue(1)

            expect(await redisCacheProvider.remove('key1')).toBe(1)
            expect(redisClientRwMock.del).toHaveBeenCalledWith('key1')
        })
    })

    describe('method: `getStatus`', () => {
        it('should return status for both clients', () => {
            const connError = new Error('Connn error')

            createClient.mockReturnValueOnce(redisClientRwMock)
            createClient.mockReturnValueOnce(redisClientRoMock)

            redisClientRwMock.on.mockImplementationOnce((_connectEvent, cb) => {
                cb()
            })
            redisClientRwMock.on.mockImplementationOnce((_errorEvent, cb) => {
                cb(connError)
            })

            redisClientRoMock.on.mockImplementationOnce((_connectEvent, cb) => {
                cb()
            })
            redisClientRoMock.on.mockImplementationOnce((_errorEvent, cb) => {
                cb(connError)
            })

            const logger = new LoggerMock()
            const redisCacheProvider = new RedisCacheProvider(config, logger)

            expect(redisCacheProvider.getStatus()).toEqual({ readWrite: 'ready', readOnly: 'ready' })
            expect(logger.info).toHaveBeenCalledWith(`Redis READ-WRITE connection open to ${JSON.stringify(config.readWrite.sentinels)}`)
            expect(logger.info).toHaveBeenCalledWith(`Redis READ-ONLY connection open to ${JSON.stringify(config.readOnly.sentinels)}`)
        })
    })
})
