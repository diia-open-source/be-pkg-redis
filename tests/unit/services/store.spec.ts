const redisClientRoMock = {
    on: jest.fn(),
    get: jest.fn(),
    keys: jest.fn(),
    mget: jest.fn(),
    hget: jest.fn(),
    hvals: jest.fn(),
    hscan: jest.fn(),
    scan: jest.fn(),
    hgetall: jest.fn(),
    hlen: jest.fn(),
    lrange: jest.fn(),
    pttl: jest.fn(),
    status: 'ready',
}

const redisClientRwMock = {
    on: jest.fn(),
    set: jest.fn(),
    hset: jest.fn(),
    lpush: jest.fn(),
    expire: jest.fn(),
    incrby: jest.fn(),
    pexpire: jest.fn(),
    del: jest.fn(),
    hdel: jest.fn(),
    flushdb: jest.fn(),
    status: 'ready',
}

const RedisServiceMock = {
    createClient: jest.fn(),
}

jest.mock('@services/redis', () => ({ RedisService: RedisServiceMock }))

import Logger from '@diia-inhouse/diia-logger'
import { ServiceUnavailableError } from '@diia-inhouse/errors'
import { mockClass } from '@diia-inhouse/test'
import { HttpStatusCode } from '@diia-inhouse/types'

import { CacheStatus, SetValueOptions, StoreService, TaggedStoreValue, TagsConfig } from '../../../src/index'
import { generateUuid } from '../../mocks/randomData'
import { config } from '../../mocks/services/store'

const LoggerMock = mockClass(Logger)

describe('StoreService', () => {
    const now = Date.now()
    const logger = new LoggerMock()

    beforeAll(() => {
        jest.useFakeTimers({ now })
    })

    afterAll(() => {
        jest.useRealTimers()
    })

    describe('event handlers', () => {
        it('should properly react on different events', () => {
            const connError = new Error('Connn error')

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)

            redisClientRoMock.on.mockImplementationOnce((_connectEvent, cb) => {
                cb()
            })
            redisClientRoMock.on.mockImplementationOnce((_errorEvent, cb) => {
                cb(connError)
            })

            redisClientRwMock.on.mockImplementationOnce((_connectEvent, cb) => {
                cb()
            })
            redisClientRwMock.on.mockImplementationOnce((_errorEvent, cb) => {
                cb(connError)
            })

            new StoreService(config, logger)

            expect(logger.info).toHaveBeenCalledWith(`Store READ-WRITE connection open to ${JSON.stringify(config.readWrite.sentinels)}`)
            expect(logger.info).toHaveBeenCalledWith('Store READ-WRITE connection error ', { err: connError })
            expect(logger.info).toHaveBeenCalledWith(`Store Path ${JSON.stringify(config.readWrite.sentinels)}`)
            expect(logger.info).toHaveBeenCalledWith(`Store READ-ONLY connection open to ${JSON.stringify(config.readOnly.sentinels)}`)
            expect(logger.info).toHaveBeenCalledWith('Store READ-ONLY connection error ', { err: connError })
            expect(logger.info).toHaveBeenCalledWith(`Store Path ${JSON.stringify(config.readOnly.sentinels)}`)
        })
    })

    describe('method: `get`', () => {
        it('should successfully get value from store', async () => {
            const key = generateUuid()
            const expectedValue = 'value'

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.get.mockResolvedValue(expectedValue)

            const storeService = new StoreService(config, logger)

            expect(await storeService.get(key)).toEqual(expectedValue)
            expect(redisClientRoMock.get).toHaveBeenCalledWith(key)
        })
    })

    describe('method: `hget`', () => {
        it('should successfully get value from hash in store', async () => {
            const key = generateUuid()
            const field = 'field'
            const expectedValue = 'value'

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.hget.mockResolvedValue(expectedValue)

            const storeService = new StoreService(config, logger)

            expect(await storeService.hget(key, field)).toEqual(expectedValue)
            expect(redisClientRoMock.hget).toHaveBeenCalledWith(key, field)
        })
    })

    describe('method: `hgetall`', () => {
        it('should successfully get all keys, values from hash in store', async () => {
            const key = generateUuid()
            const expectedValue = { '1': 'value', '2': 'value' }

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.hgetall.mockResolvedValue(expectedValue)

            const storeService = new StoreService(config, logger)

            expect(await storeService.hgetall(key)).toEqual(expectedValue)
            expect(redisClientRoMock.hgetall).toHaveBeenCalledWith(key)
        })
    })

    describe('method: `hvals`', () => {
        it('should successfully get all values from hash in store', async () => {
            const key = generateUuid()
            const expectedValue = ['value', 'value2']

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.hvals.mockResolvedValue(expectedValue)

            const storeService = new StoreService(config, logger)

            expect(await storeService.hvals(key)).toEqual(expectedValue)
            expect(redisClientRoMock.hvals).toHaveBeenCalledWith(key)
        })
    })

    describe('method: `hscan`', () => {
        it('should successfully get fist batch of scanned values in a hash', async () => {
            const key = generateUuid()
            const count = 100
            const cursor = 0
            const expectedValue = { cursor, elements: ['1', '2'] }
            const mockedValue = [cursor, ['1', '2']]

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.hscan.mockResolvedValue(mockedValue)

            const storeService = new StoreService(config, logger)

            expect(await storeService.hscan(key, cursor, count)).toEqual(expectedValue)
            expect(redisClientRoMock.hscan).toHaveBeenCalledWith(key, cursor, 'COUNT', count)
        })
    })

    describe('method: `scan`', () => {
        it('should successfully get fist batch of scanned values', async () => {
            const match = `${generateUuid()}_*`
            const count = 100
            const cursor = 0
            const expectedValue = { cursor, elements: ['1', '2'] }
            const mockedValue = [cursor, ['1', '2']]

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.scan.mockResolvedValue(mockedValue)

            const storeService = new StoreService(config, logger)

            expect(await storeService.scan(match, cursor, count)).toEqual(expectedValue)
            expect(redisClientRoMock.scan).toHaveBeenCalledWith(cursor, 'MATCH', match, 'COUNT', count)
        })
    })

    describe('method: `hlen`', () => {
        it('should successfully get length of list from store', async () => {
            const key = generateUuid()
            const expectedValue = 1

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.hlen.mockResolvedValue(expectedValue)

            const storeService = new StoreService(config, logger)

            expect(await storeService.hlen(key)).toEqual(expectedValue)
            expect(redisClientRoMock.hlen).toHaveBeenCalledWith(key)
        })
    })

    describe('method: `lrange`', () => {
        it('should successfully get values from list in store', async () => {
            const key = generateUuid()
            const start = 0
            const stop = -1
            const expectedValue = ['1', '2']

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.lrange.mockResolvedValue(expectedValue)

            const storeService = new StoreService(config, logger)

            expect(await storeService.lrange(key, start, stop)).toEqual(expectedValue)
            expect(redisClientRoMock.lrange).toHaveBeenCalledWith(key, start, stop)
        })
    })

    describe('method: `getUsingTags`', () => {
        it.each([
            ['cached value is null', generateUuid(), null, null, null],
            [
                'there are no tags',
                generateUuid(),
                JSON.stringify(<TaggedStoreValue>{ data: 'value', tags: [], timestamp: 1800 }),
                null,
                'value',
            ],
            [
                'invalid tags',
                generateUuid(),
                JSON.stringify(<TaggedStoreValue>{ data: 'value', tags: ['publicService'], timestamp: 1800 }),
                JSON.stringify(<TagsConfig>{ publicService: 1900 }),
                null,
            ],
            [
                'valid tags',
                generateUuid(),
                JSON.stringify(<TaggedStoreValue>{ data: 'value', tags: ['publicService'], timestamp: 1800 }),
                JSON.stringify(<TagsConfig>{ publicService: 1800 }),
                'value',
            ],
        ])(
            'should successfully get value using tags in case %s',
            async (_msg: string, key: string, cachedValue: string | null, tagsConfig: string | null, expectedValue: string | null) => {
                RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
                RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
                redisClientRoMock.mget.mockResolvedValue([cachedValue, tagsConfig])

                const storeService = new StoreService(config, logger)

                expect(await storeService.getUsingTags(key)).toEqual(expectedValue)
                expect(redisClientRoMock.mget).toHaveBeenCalledWith(key, '_tags')
            },
        )

        it('should fail to get value from store using tags when invalid json value received', async () => {
            const key = generateUuid()
            const expectedError = new ServiceUnavailableError()

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.mget.mockResolvedValue(['invalid-json-string', null])

            const storeService = new StoreService(config, logger)

            await expect(async () => {
                await storeService.getUsingTags(key)
            }).rejects.toEqual(expectedError)
            expect(redisClientRoMock.mget).toHaveBeenCalledWith(key, '_tags')
            expect(logger.error).toHaveBeenCalledWith('Failed when parse value with tags', {
                err: new SyntaxError(`Unexpected token 'i', "invalid-json-string" is not valid JSON`),
            })
        })
    })

    describe('method: `remove`', () => {
        it('should successfully remove value from store', async () => {
            const key = generateUuid()

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRwMock.del.mockResolvedValue(1)

            const storeService = new StoreService(config, logger)

            expect(await storeService.remove(key)).toBe(1)
            expect(redisClientRwMock.del).toHaveBeenCalledWith(key)
        })
    })

    describe('method: `hdel`', () => {
        it('should successfully remove field from hash in store', async () => {
            const key = generateUuid()
            const field = 'field'

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRwMock.hdel.mockResolvedValue(1)

            const storeService = new StoreService(config, logger)

            expect(await storeService.hdel(key, field)).toBe(1)
            expect(redisClientRwMock.hdel).toHaveBeenCalledWith(key, field)
        })
    })

    describe('method: `incrby`', () => {
        it('should successfully increment field for value', async () => {
            const key = generateUuid()
            const value = 100

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRwMock.incrby.mockResolvedValue(value)

            const storeService = new StoreService(config, logger)

            expect(await storeService.incrby(key, value)).toBe(value)
            expect(redisClientRwMock.incrby).toHaveBeenCalledWith(key, value)
        })
    })

    describe('method: `expire`', () => {
        it('should set expiration for a key', async () => {
            const key = generateUuid()
            const seconds = 1

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRwMock.expire.mockResolvedValue(1)

            const storeService = new StoreService(config, logger)

            expect(await storeService.expire(key, seconds)).toBe(1)
            expect(redisClientRwMock.expire).toHaveBeenCalledWith(key, seconds, 'NX')
        })
    })

    describe('method: `set`', () => {
        it('should set value in store with provided ttl', async () => {
            const key = generateUuid()
            const value = 'value'
            const options: SetValueOptions = { tags: ['publicService'], ttl: 1800 }

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.get.mockResolvedValue(JSON.stringify(<TagsConfig>{ publicService: 1800 }))
            redisClientRwMock.set.mockResolvedValue('OK')

            const storeService = new StoreService(config, logger)

            expect(await storeService.set(key, value, options)).toBe('OK')
            expect(redisClientRoMock.get).toHaveBeenCalledWith('_tags')
            expect(redisClientRwMock.set).toHaveBeenCalledWith(
                key,
                JSON.stringify({ data: value, tags: ['publicService'], timestamp: 1800 }),
                'PX',
                options.ttl,
            )
        })

        it('should set value in store without ttl', async () => {
            const key = generateUuid()
            const value = 'value'
            const options: SetValueOptions = { tags: ['publicService'] }

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.get.mockResolvedValue(null)
            redisClientRwMock.set.mockResolvedValue('OK')

            const storeService = new StoreService(config, logger)

            expect(await storeService.set(key, value, options)).toBe('OK')
            expect(redisClientRoMock.get).toHaveBeenCalledWith('_tags')
            expect(redisClientRwMock.set).toHaveBeenCalledWith(key, JSON.stringify({ data: value, tags: ['publicService'], timestamp: 0 }))
        })

        it('should set value in store without any options', async () => {
            const key = generateUuid()
            const value = 'value'

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRwMock.set.mockResolvedValue('OK')

            const storeService = new StoreService(config, logger)

            expect(await storeService.set(key, value)).toBe('OK')
            expect(redisClientRwMock.set).toHaveBeenCalledWith(key, value)
        })
    })

    describe('method: `hset`', () => {
        it('should set value in store', async () => {
            const key = generateUuid()
            const value = { '1': 'value' }

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRwMock.hset.mockResolvedValue(1)

            const storeService = new StoreService(config, logger)

            expect(await storeService.hset(key, value)).toBe(1)
            expect(redisClientRwMock.hset).toHaveBeenCalledWith(key, value)
        })
    })

    describe('method: `lpush`', () => {
        it('should push value to the list in store', async () => {
            const key = generateUuid()
            const value = 'value'

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRwMock.lpush.mockResolvedValue(1)

            const storeService = new StoreService(config, logger)

            expect(await storeService.lpush(key, value)).toBe(1)
            expect(redisClientRwMock.lpush).toHaveBeenCalledWith(key, value)
        })
    })

    describe('method: `remember`', () => {
        it('should just return item from cache', async () => {
            const key = generateUuid()
            const expectedValue = 'value'
            const closure = jest.fn()

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.get.mockResolvedValue(expectedValue)
            closure.mockResolvedValueOnce(expectedValue)

            const storeService = new StoreService(config, logger)

            expect(await storeService.remember(key, closure)).toEqual(expectedValue)
            expect(redisClientRoMock.get).toHaveBeenCalledWith(key)
            expect(closure).not.toHaveBeenCalledWith()
        })

        it.each(['value', ''])('should set item `%s` received from closure in store', async (expectedValue) => {
            const key = generateUuid()
            const closure = jest.fn()

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.get.mockResolvedValue(null)
            closure.mockResolvedValueOnce(expectedValue)

            const storeService = new StoreService(config, logger)

            expect(await storeService.remember(key, closure, {})).toEqual(expectedValue)
            expect(redisClientRoMock.get).toHaveBeenCalledWith(key)
            expect(closure).toHaveBeenCalledWith()
            expect(redisClientRwMock.set).toHaveBeenCalledWith(key, expectedValue)
        })
    })

    describe('method: `onHealthCheck`', () => {
        it.each([
            [
                'OK',
                ['ready', 'ready'],
                { status: HttpStatusCode.OK, details: { store: <CacheStatus>{ readOnly: 'ready', readWrite: 'ready' } } },
            ],
            [
                'SERVICE_UNAVAILABLE',
                ['connecting', 'ready'],
                {
                    status: HttpStatusCode.SERVICE_UNAVAILABLE,
                    details: { store: <CacheStatus>{ readOnly: 'ready', readWrite: 'connecting' } },
                },
            ],
        ])('should return health status `%s`', async (_status, [rw, ro], expectedStatus) => {
            RedisServiceMock.createClient.mockReturnValueOnce({ ...redisClientRwMock, status: rw })
            RedisServiceMock.createClient.mockReturnValueOnce({ ...redisClientRoMock, ro })

            const storeService = new StoreService(config, logger)

            expect(await storeService.onHealthCheck()).toEqual(expectedStatus)
        })
    })

    describe('method: `bumpTags`', () => {
        it.each([
            [
                'tags config exists in store',
                JSON.stringify(<TagsConfig>{ ['faq']: now }),
                JSON.stringify(<TagsConfig>{ ['faq']: now, ['publicService']: now }),
            ],
            ['tags does not exist in store', null, JSON.stringify(<TagsConfig>{ ['publicService']: now })],
        ])('should successfully bump tags when %s', async (_msg, tagsConfig: string | null, expectedTagsConfig: string) => {
            const tags: string[] = ['publicService']

            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.get.mockResolvedValue(tagsConfig)
            redisClientRwMock.set.mockResolvedValue('OK')

            const storeService = new StoreService(config, logger)

            expect(await storeService.bumpTags(tags)).toBe('OK')
            expect(redisClientRoMock.get).toHaveBeenCalledWith('_tags')
            expect(redisClientRwMock.set).toHaveBeenCalledWith('_tags', expectedTagsConfig)
        })
    })

    describe('method: `flushDb`', () => {
        it('should successfully flush entire store', async () => {
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRwMock)
            RedisServiceMock.createClient.mockReturnValueOnce(redisClientRoMock)
            redisClientRwMock.flushdb.mockResolvedValue('OK')

            const storeService = new StoreService(config, logger)

            expect(await storeService.flushDb()).toBe('OK')
            expect(redisClientRwMock.flushdb).toHaveBeenCalledWith()
        })
    })
})
