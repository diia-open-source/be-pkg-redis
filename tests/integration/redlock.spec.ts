import { randomUUID } from 'node:crypto'

import { DiiaLogger } from '@diia-inhouse/diia-logger'

import { RedlockService } from '../../src/index'

describe(`${RedlockService.name} service`, () => {
    // store.spec.ts flushes db 0 after each test and would wipe the held lock mid-test
    const redisOptions = { port: 6379, db: 1 }
    let redlock: RedlockService

    beforeEach(() => {
        redlock = new RedlockService({ readWrite: redisOptions, readOnly: redisOptions }, new DiiaLogger())
    })

    afterEach(async () => {
        await redlock.onDestroy()
    })

    describe('method: `lock`', () => {
        it('gives up acquiring a held lock after the provided acquireTimeout', async () => {
            const resource = `resource-${randomUUID()}`
            const ttl = 1000
            const holder = await redlock.lock(resource, ttl)

            try {
                const startedAt = Date.now()

                await expect(redlock.lock(resource, ttl, { acquireTimeout: 200, retryInterval: 50 })).rejects.toThrow(
                    `Acquire redlock-mutex mutex:${resource} timeout`,
                )

                expect(Date.now() - startedAt).toBeLessThan(ttl)
            } finally {
                await holder.release()
            }
        })
    })

    describe('method: `tryLock`', () => {
        it('returns null instead of throwing when a held lock is not acquired within acquireTimeout', async () => {
            const resource = `resource-${randomUUID()}`
            const ttl = 1000
            const holder = await redlock.lock(resource, ttl)

            try {
                const startedAt = Date.now()

                expect(await redlock.tryLock(resource, ttl, { acquireTimeout: 200, retryInterval: 50 })).toBeNull()

                expect(Date.now() - startedAt).toBeLessThan(ttl)
            } finally {
                await holder.release()
            }
        })

        it('returns a held lock when the resource is free', async () => {
            const resource = `resource-${randomUUID()}`
            const ttl = 1000

            const lock = await redlock.tryLock(resource, ttl)

            try {
                expect(lock?.isAcquired).toBe(true)
                expect(await redlock.tryLock(resource, ttl, { acquireTimeout: 100, retryInterval: 50 })).toBeNull()
            } finally {
                await lock?.release()
            }

            const reacquired = await redlock.tryLock(resource, ttl, { acquireTimeout: 100, retryInterval: 50 })

            expect(reacquired).not.toBeNull()
            await reacquired?.release()
        })
    })
})
