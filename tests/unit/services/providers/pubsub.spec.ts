/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable unicorn/consistent-function-scoping */
import { Redis } from 'ioredis'
import { mock } from 'vitest-mock-extended'

import Logger from '@diia-inhouse/diia-logger'

import { PubSubProvider } from '../../../../src/services/providers/pubsub'
import { RedisService } from '../../../../src/services/redis'
import { generateUuid } from '../../../mocks/randomData'
import { config } from '../../../mocks/services/providers/pubsub'

const redisClientSubMock = {
    on: vi.fn<() => any>(),
    subscribe: vi.fn<() => any>(),
    unsubscribe: vi.fn<() => any>(),
    status: 'ready',
} as unknown as Redis

const redisClientPubMock = {
    on: vi.fn<() => any>(),
    publish: vi.fn<() => any>(),
    status: 'ready',
} as unknown as Redis

describe('PubSubProvider', () => {
    describe('method: `unsubscribe`', () => {
        it('should successfully unsubscribe handler and log in case handler does not exist', async () => {
            const channel = generateUuid()

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientPubMock).mockReturnValueOnce(redisClientSubMock)

            vi.mocked(redisClientSubMock.on as any).mockImplementation((_event: any, cb: any) => {
                cb(channel, '{}')
            })

            const logger = mock<Logger>()
            const pubSubProvider = new PubSubProvider(config, logger)

            vi.mocked(redisClientSubMock.subscribe).mockResolvedValue(null)

            await pubSubProvider.onceChannelMessage(channel, async () => {})
            await pubSubProvider.unsubscribe(channel)

            expect(logger.error).toHaveBeenCalledWith(`Could not find a message handler for the channel ${channel}`)
            expect(logger.info).toHaveBeenCalledWith('Redis READ-WRITE sub connection open', { sentinels: config.readWrite.sentinels })
        })
    })

    describe('method: `publish`', () => {
        it('should successfully publish message', async () => {
            const channel = generateUuid()

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientPubMock).mockReturnValueOnce(redisClientSubMock)

            const logger = mock<Logger>()
            const pubSubProvider = new PubSubProvider(config, logger)

            vi.mocked(redisClientPubMock.publish).mockResolvedValue(1)

            expect(await pubSubProvider.publish(channel, {})).toBe(1)
        })
    })

    describe('method: `onceChannelMessage`', () => {
        const captureMessageHandler =
            (ref: { handler: CallableFunction }): ((event: any, cb: any) => void) =>
            (event, cb) => {
                const isMessage = event === 'message'

                ref.handler = isMessage ? cb : ref.handler
            }

        it('should successfully register handler for channel and then handle received message', async () => {
            const handlerRef: { handler: CallableFunction } = { handler: async () => {} }

            const channel = generateUuid()

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientPubMock).mockReturnValueOnce(redisClientSubMock)

            vi.mocked(redisClientSubMock.on as any).mockImplementation(captureMessageHandler(handlerRef))

            const logger = mock<Logger>()
            const pubSubProvider = new PubSubProvider(config, logger)

            vi.mocked(redisClientSubMock.subscribe).mockResolvedValue(null)

            await pubSubProvider.onceChannelMessage(channel, async (message) => {
                expect(message).toBe('{}')
            })

            await handlerRef.handler(channel, '{}')
        })

        it('should fail to register handler for channel in case it was already registered', async () => {
            const channel = generateUuid()

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientPubMock).mockReturnValueOnce(redisClientSubMock)

            const logger = mock<Logger>()
            const pubSubProvider = new PubSubProvider(config, logger)

            vi.mocked(redisClientSubMock.subscribe).mockResolvedValue(null)

            await pubSubProvider.onceChannelMessage(channel, async () => {})

            await expect(pubSubProvider.onceChannelMessage(channel, async () => {})).rejects.toEqual(
                new Error(`Handler already exists by the provided channel ${channel}`),
            )
        })

        it('should successfully register handler for channel and then only log error in case handler rejects', async () => {
            const handlerRef: { handler: CallableFunction } = { handler: async () => {} }

            const channel = generateUuid()
            const expectedError = new Error('Unable to handle message')

            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientPubMock).mockReturnValueOnce(redisClientSubMock)

            vi.mocked(redisClientSubMock.on as any).mockImplementation(captureMessageHandler(handlerRef))

            const logger = mock<Logger>()
            const pubSubProvider = new PubSubProvider(config, logger)

            vi.mocked(redisClientSubMock.subscribe).mockResolvedValue(null)

            await pubSubProvider.onceChannelMessage(channel, async () => {
                throw expectedError
            })

            await handlerRef.handler(channel, '{}')

            expect(logger.error).toHaveBeenCalledWith(`Failed to handle message from the channel ${channel}`, { err: expectedError })
        })
    })

    describe('method: `getStatus`', () => {
        it('should return status for both pub/sub', () => {
            vi.spyOn(RedisService, 'createClient').mockReturnValueOnce(redisClientPubMock).mockReturnValueOnce(redisClientSubMock)

            vi.mocked(redisClientPubMock.on as any).mockImplementationOnce((_connectEvent: any, cb: any) => {
                cb()
            })
            vi.mocked(redisClientPubMock.on as any).mockImplementationOnce((_errorEvent: any, cb: any) => {
                cb(new Error('Some error'))
            })

            vi.mocked(redisClientSubMock.on as any).mockImplementationOnce((_connectEvent: any, cb: any) => {
                cb()
            })
            vi.mocked(redisClientSubMock.on as any).mockImplementationOnce((_errorEvent: any, cb: any) => {
                cb(new Error('Some error'))
            })

            const logger = mock<Logger>()
            const pubSubProvider = new PubSubProvider(config, logger)

            expect(pubSubProvider.getStatus()).toEqual({ pub: 'ready', sub: 'ready' })
            expect(logger.info).toHaveBeenCalledTimes(2)
        })
    })
})
