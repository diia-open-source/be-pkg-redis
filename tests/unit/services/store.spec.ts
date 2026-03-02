/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock } from 'vitest-mock-extended'

import Logger from '@diia-inhouse/diia-logger'
import { ServiceUnavailableError } from '@diia-inhouse/errors'
import { HttpStatusCode } from '@diia-inhouse/types'

import { SetValueOptions, StoreService, StoreStatus, TaggedStoreValue, TagsConfig } from '../../../src/index'
import { RedisService } from '../../../src/services/redis'
import { generateUuid } from '../../mocks/randomData'
import { config } from '../../mocks/services/store'

const redisClientRoMock = {
    on: vi.fn(),
    get: vi.fn(),
    keys: vi.fn(),
    mget: vi.fn(),
    hget: vi.fn(),
    hvals: vi.fn(),
    hscan: vi.fn(),
    scan: vi.fn(),
    hgetall: vi.fn(),
    hlen: vi.fn(),
    lrange: vi.fn(),
    pttl: vi.fn(),
    status: 'ready',
} as any

const redisClientRwMock = {
    on: vi.fn(),
    set: vi.fn(),
    hset: vi.fn(),
    lpush: vi.fn(),
    expire: vi.fn(),
    incrby: vi.fn(),
    pexpire: vi.fn(),
    del: vi.fn(),
    hdel: vi.fn(),
    flushdb: vi.fn(),
    status: 'ready',
} as any

describe('StoreService', () => {
    const now = Date.now()
    const logger = mock<Logger>()

    beforeAll(() => {
        vi.useFakeTimers({ now })
    })

    afterAll(() => {
        vi.useRealTimers()
    })

    describe('event handlers', () => {
        it('should properly react on different events', () => {
            const connError = new Error('Connn error')

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)

            vi.mocked(redisClientRoMock.on as any).mockImplementationOnce((_connectEvent: any, cb: any) => {
                cb()
            })
            vi.mocked(redisClientRoMock.on as any).mockImplementationOnce((_errorEvent: any, cb: any) => {
                cb(connError)
            })

            vi.mocked(redisClientRwMock.on as any).mockImplementationOnce((_connectEvent: any, cb: any) => {
                cb()
            })
            vi.mocked(redisClientRwMock.on as any).mockImplementationOnce((_errorEvent: any, cb: any) => {
                cb(connError)
            })

            new StoreService(config, logger)

            expect(logger.info).toHaveBeenCalledWith('Store READ-WRITE connection open')
            expect(logger.error).toHaveBeenCalledWith('Store READ-WRITE connection error ', { err: connError })
            expect(logger.info).toHaveBeenCalledWith('Store READ-ONLY connection open')
            expect(logger.error).toHaveBeenCalledWith('Store READ-ONLY connection error ', { err: connError })
        })
    })

    describe('method: `get`', () => {
        it('should successfully get value from store', async () => {
            const key = generateUuid()
            const expectedValue = 'value'

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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
                JSON.stringify({ data: 'value', tags: [], timestamp: 1800 } as TaggedStoreValue),
                null,
                'value',
            ],
            [
                'invalid tags',
                generateUuid(),
                JSON.stringify({ data: 'value', tags: ['publicService'], timestamp: 1800 } as TaggedStoreValue),
                JSON.stringify({ publicService: 1900 } as TagsConfig),
                null,
            ],
            [
                'valid tags',
                generateUuid(),
                JSON.stringify({ data: 'value', tags: ['publicService'], timestamp: 1800 } as TaggedStoreValue),
                JSON.stringify({ publicService: 1800 } as TagsConfig),
                'value',
            ],
        ])(
            'should successfully get value using tags in case %s',
            async (_msg: string, key: string, cachedValue: string | null, tagsConfig: string | null, expectedValue: string | null) => {
                vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
                redisClientRoMock.mget.mockResolvedValue([cachedValue, tagsConfig])

                const storeService = new StoreService(config, logger)

                expect(await storeService.getUsingTags(key)).toEqual(expectedValue)
                expect(redisClientRoMock.mget).toHaveBeenCalledWith(key, '_tags')
            },
        )

        it('should fail to get value from store using tags when invalid json value received', async () => {
            const key = generateUuid()
            const expectedError = new ServiceUnavailableError()

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.mget.mockResolvedValue(['invalid-json-string', null])

            const storeService = new StoreService(config, logger)

            await expect(storeService.getUsingTags(key)).rejects.toEqual(expectedError)
            expect(redisClientRoMock.mget).toHaveBeenCalledWith(key, '_tags')
            expect(logger.error).toHaveBeenCalledWith('Failed when parse value with tags', {
                err: new SyntaxError(`Unexpected token 'i', "invalid-json-string" is not valid JSON`),
            })
        })
    })

    describe('method: `remove`', () => {
        it('should successfully remove value from store', async () => {
            const key = generateUuid()

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.get.mockResolvedValue(JSON.stringify({ publicService: 1800 } as TagsConfig))
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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
            const closure = vi.fn()

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
            redisClientRoMock.get.mockResolvedValue(expectedValue)
            closure.mockResolvedValueOnce(expectedValue)

            const storeService = new StoreService(config, logger)

            expect(await storeService.remember(key, closure)).toEqual(expectedValue)
            expect(redisClientRoMock.get).toHaveBeenCalledWith(key)
            expect(closure).not.toHaveBeenCalledWith()
        })

        it.each(['value', ''])('should set item `%s` received from closure in store', async (expectedValue) => {
            const key = generateUuid()
            const closure = vi.fn()

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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
                { status: HttpStatusCode.OK, details: { store: { readOnly: 'ready', readWrite: 'ready' } as StoreStatus } },
            ],
            [
                'SERVICE_UNAVAILABLE',
                ['connecting', 'ready'],
                {
                    status: HttpStatusCode.SERVICE_UNAVAILABLE,
                    details: { store: { readOnly: 'ready', readWrite: 'connecting' } as StoreStatus },
                },
            ],
        ])('should return health status `%s`', async (_status, [rw, ro], expectedStatus) => {
            vi.spyOn(RedisService, 'createClient')
                .mockReturnValueOnce({ ...redisClientRwMock, status: rw })
                .mockReturnValueOnce({ ...redisClientRoMock, status: ro })

            const storeService = new StoreService(config, logger)

            expect(await storeService.onHealthCheck()).toEqual(expectedStatus)
        })
    })

    describe('method: `bumpTags`', () => {
        it.each([
            [
                'tags config exists in store',
                JSON.stringify({ ['faq']: now } as TagsConfig),
                JSON.stringify({ ['faq']: now, ['publicService']: now } as TagsConfig),
            ],
            ['tags does not exist in store', null, JSON.stringify({ ['publicService']: now } as TagsConfig)],
        ])('should successfully bump tags when %s', async (_msg, tagsConfig: string | null, expectedTagsConfig: string) => {
            const tags: string[] = ['publicService']

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
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
            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientRwMock).mockReturnValueOnce(redisClientRoMock)
            redisClientRwMock.flushdb.mockResolvedValue('OK')

            const storeService = new StoreService(config, logger)

            expect(await storeService.flushDb()).toBe('OK')
            expect(redisClientRwMock.flushdb).toHaveBeenCalledWith()
        })
    })
})
