import { randomUUID } from 'node:crypto'

import { DiiaLogger } from '@diia-inhouse/diia-logger'
import { HttpStatusCode } from '@diia-inhouse/types'

import { PubSubService, RedisStatusValue } from '../../src/index'

describe(`${PubSubService.name} service`, () => {
    const redisOptions = { port: 6379 }
    let logger: DiiaLogger
    let pubsub: PubSubService
    let channel: string

    beforeEach(() => {
        logger = new DiiaLogger()
        pubsub = new PubSubService({ readWrite: redisOptions, readOnly: redisOptions }, logger)
        channel = `channel-${randomUUID()}`
    })

    afterEach(async () => {
        await pubsub.onDestroy()
    })

    describe('method: `onChannelMessage`', () => {
        it('delivers every published message to the channel handler as a JSON string', async () => {
            const received: string[] = []
            const payloads = [{ id: 1 }, { id: 2 }]

            await pubsub.onChannelMessage(channel, async (message) => {
                received.push(message)
            })

            for (const payload of payloads) {
                expect(await pubsub.publish(channel, payload)).toBe(1)
            }

            await vi.waitFor(() => expect(received).toHaveLength(payloads.length))
            expect(received.map((message) => JSON.parse(message))).toEqual(payloads)
        })

        it('does not deliver messages published to another channel', async () => {
            const handler = vi.fn<(message: string) => Promise<void>>()

            await pubsub.onChannelMessage(channel, handler)

            expect(await pubsub.publish(`other-${channel}`, { id: 1 })).toBe(0)

            const delivered = vi.fn<(message: string) => Promise<void>>()

            await pubsub.onChannelMessage(`${channel}-sentinel`, delivered)
            await pubsub.publish(`${channel}-sentinel`, { id: 2 })
            await vi.waitFor(() => expect(delivered).toHaveBeenCalledOnce())

            expect(handler).not.toHaveBeenCalled()
        })

        it('rejects a second handler for the same channel', async () => {
            await pubsub.onChannelMessage(channel, async () => {})

            await expect(pubsub.onChannelMessage(channel, async () => {})).rejects.toThrow(
                `Handler already exists by the provided channel ${channel}`,
            )
        })

        it('keeps delivering messages after the handler throws', async () => {
            const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
            const handler = vi
                .fn<(message: string) => Promise<void>>()
                .mockRejectedValueOnce(new Error('handler failure'))
                .mockResolvedValueOnce()

            await pubsub.onChannelMessage(channel, handler)

            await pubsub.publish(channel, { id: 1 })
            await pubsub.publish(channel, { id: 2 })

            await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2))
            expect(JSON.parse(handler.mock.calls[1][0])).toEqual({ id: 2 })
            expect(errorSpy).toHaveBeenCalledWith(
                `Failed to handle message from the channel ${channel}`,
                expect.objectContaining({ err: expect.objectContaining({ message: 'handler failure' }) }),
            )
        })
    })

    describe('method: `onceChannelMessage`', () => {
        it('handles only the first message and then unsubscribes from the channel', async () => {
            const handler = vi.fn<(message: string) => Promise<void>>()

            await pubsub.onceChannelMessage(channel, handler)

            expect(await pubsub.publish(channel, { id: 1 })).toBe(1)
            await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce())
            expect(JSON.parse(handler.mock.calls[0][0])).toEqual({ id: 1 })

            // the subscriber is removed after the first message, so nobody receives the second one
            await vi.waitFor(async () => expect(await pubsub.publish(channel, { id: 2 })).toBe(0))
            expect(handler).toHaveBeenCalledOnce()
        })

        it('logs the error and still unsubscribes when the one-time handler throws', async () => {
            const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

            await pubsub.onceChannelMessage(channel, async () => {
                throw new Error('once failure')
            })

            await pubsub.publish(channel, { id: 1 })

            await vi.waitFor(() =>
                expect(errorSpy).toHaveBeenCalledWith(
                    `Failed to handle message from the channel ${channel}`,
                    expect.objectContaining({ err: expect.objectContaining({ message: 'once failure' }) }),
                ),
            )
            expect(await pubsub.publish(channel, { id: 2 })).toBe(0)
        })

        it('rejects a second one-time handler for the same channel', async () => {
            await pubsub.onceChannelMessage(channel, async () => {})

            await expect(pubsub.onceChannelMessage(channel, async () => {})).rejects.toThrow(
                `Handler already exists by the provided channel ${channel}`,
            )
        })
    })

    describe('method: `unsubscribe`', () => {
        it('stops delivering messages and allows registering a new handler for the channel', async () => {
            const first = vi.fn<(message: string) => Promise<void>>()
            const second = vi.fn<(message: string) => Promise<void>>()

            await pubsub.onChannelMessage(channel, first)
            await pubsub.unsubscribe(channel)

            expect(await pubsub.publish(channel, { id: 1 })).toBe(0)

            await pubsub.onChannelMessage(channel, second)
            await pubsub.publish(channel, { id: 2 })

            await vi.waitFor(() => expect(second).toHaveBeenCalledOnce())
            expect(first).not.toHaveBeenCalled()
        })
    })

    describe('method: `onHealthCheck`', () => {
        it('reports OK when both pub and sub connections are ready', async () => {
            // subscribing proves the sub connection is ready, publishing proves the pub connection is
            await pubsub.onChannelMessage(channel, async () => {})
            await pubsub.publish(channel, {})

            const result = await pubsub.onHealthCheck()

            expect(result).toEqual({
                status: HttpStatusCode.OK,
                details: { pubsub: { pub: RedisStatusValue.Ready, sub: RedisStatusValue.Ready } },
            })
        })

        it('reports SERVICE_UNAVAILABLE once the connections are closed', async () => {
            const closing = new PubSubService({ readWrite: redisOptions, readOnly: redisOptions }, logger)

            await closing.onChannelMessage(`closing-${channel}`, async () => {})
            await closing.onDestroy()

            // ioredis resolves quit() on the QUIT reply; the status becomes `end` once the socket is closed
            await vi.waitFor(async () => {
                const result = await closing.onHealthCheck()

                expect(result.status).toBe(HttpStatusCode.SERVICE_UNAVAILABLE)
                expect(result.details.pubsub.pub).not.toBe(RedisStatusValue.Ready)
                expect(result.details.pubsub.sub).not.toBe(RedisStatusValue.Ready)
            })
        })
    })
})
