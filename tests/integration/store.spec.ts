import { randomUUID } from 'crypto'

import DiiaLogger from '@diia-inhouse/diia-logger'
import { ServiceUnavailableError } from '@diia-inhouse/errors'

import { StoreService, StoreTag } from '../../src/index'

let store: StoreService

describe(`${StoreService.name} service`, () => {
    beforeEach(async () => {
        const logger = new DiiaLogger()

        store = new StoreService({ readWrite: { port: 6379 }, readOnly: { port: 6379 } }, logger)
    })

    const key = 'key'
    const value = 'value'

    afterEach(async () => {
        await store.flushDb()
    })

    describe('Basic operations with store', () => {
        describe('get value', () => {
            it('gets null if key does not exist', async () => {
                // Act
                const res = await store.get(key)

                expect(res).toBeNull()
            })

            it('gets value if key exists', async () => {
                await store.set(key, value)

                // Act
                const res = await store.get(key)

                expect(res).toEqual(value)
            })
        })

        describe('set value', () => {
            it('successfully sets value', async () => {
                // Act
                await store.set(key, value)

                const res = await store.get(key)

                expect(res).toEqual(value)
            })

            it('sets value with expiration', async () => {
                const ttl = 100

                // Act
                await store.set(key, value, { ttl })

                const res = await store.get(key)

                expect(res).toEqual(value)
            })

            it('fails to get value when value expires', async () => {
                const ttl = 100

                // Act
                await store.set(key, value, { ttl })

                await new Promise((resolve) => setTimeout(resolve, ttl + 10))

                const res = await store.get(key)

                expect(res).toBeNull()
            })
        })

        describe('remove value', () => {
            it('ignores remove operation if key not exist', async () => {
                // Act
                const res: number = await store.remove(key)

                expect(res).toBe(0)
            })
            it('removes value if key exists', async () => {
                await store.set(key, value)

                // Act
                const res: number = await store.remove(key)

                expect(res).toBe(1)
                expect(await store.get(key)).toBeNull()
            })

            it('removes multiple keys', async () => {
                const key1 = 'key1'
                const key2 = 'key2'
                const nonExistingKey = 'nonExistingKey'

                await store.set(key1, value)
                await store.set(key2, value)

                // Act
                const res: number = await store.remove(key1, key2, nonExistingKey)

                expect(res).toBe(2)
                expect(await store.get(key1)).toBeNull()
                expect(await store.get(key2)).toBeNull()
            })
        })

        describe('get & Set value with remember method', () => {
            it('should return value from closure and save in cache if key does not exist', async () => {
                // Act
                const rememberValue = await store.remember(key, async () => {
                    return value
                })

                const valueFromCache = await store.get(key)

                // Assert
                expect(valueFromCache).toEqual(rememberValue)
            })

            it('should return value from cache if key exists', async () => {
                // Arrange
                const randomValue = randomUUID().toString()

                await store.set(key, randomValue)

                // Act
                const rememberValue = await store.remember(key, async () => {
                    return value
                })

                // Assert
                expect(rememberValue).toEqual(randomValue)
            })
        })
    })

    describe('Operations with tagged values', () => {
        it('fails to get untagged value', async () => {
            await store.set(key, value)

            // Act
            await expect(store.getUsingTags(key)).rejects.toThrow(ServiceUnavailableError)
        })

        it('gets tagged value without tag in cache', async () => {
            await store.set(key, value, { tags: [StoreTag.PublicService] })

            // Act
            const res = await store.getUsingTags(key)

            expect(res).toEqual(value)
        })

        it('gets tagged value when value is older than tag', async () => {
            await store.bumpTags([StoreTag.PublicService])
            await store.set(key, value, { tags: [StoreTag.PublicService] })

            // Act
            const res = await store.getUsingTags(key)

            expect(res).toEqual(value)
        })

        it('key becomes invalid when at least one tag is bumped', async () => {
            await store.set(key, value, { tags: [StoreTag.PublicService, StoreTag.PublicServiceCategory] })
            await store.bumpTags([StoreTag.PublicService])

            // Act
            const res = await store.getUsingTags(key)

            expect(res).toBeNull()
        })

        it('all keys becomes invalid when common tag is bumped', async () => {
            const key1 = 'key1'
            const key2 = 'key2'

            await store.set(key1, value, { tags: [StoreTag.PublicService] })
            await store.set(key2, value, { tags: [StoreTag.PublicService] })

            // Act
            await store.bumpTags([StoreTag.PublicService])

            expect(await store.getUsingTags(key1)).toBeNull()
            expect(await store.getUsingTags(key2)).toBeNull()
        })
    })
})
