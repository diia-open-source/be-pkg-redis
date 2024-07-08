/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable jest/no-conditional-in-test */
const redisClientSubMock = {
    on: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    status: 'ready',
}

const redisClientPubMock = {
    on: jest.fn(),
    publish: jest.fn(),
    status: 'ready',
}

const createClient = jest.fn()

const RedisServiceMock = {
    createClient: createClient,
}

jest.mock('@services/redis', () => ({ RedisService: RedisServiceMock }))

import Logger from '@diia-inhouse/diia-logger'
import { mockClass } from '@diia-inhouse/test'

import { PubSubProvider } from '../../../../src/services/providers/pubsub'
import { generateUuid } from '../../../mocks/randomData'
import { config } from '../../../mocks/services/providers/pubsub'

const LoggerMock = mockClass(Logger)

describe('PubSubProvider', () => {
    describe('method: `unsubscribe`', () => {
        it('should successfully unsubscribe handler and log in case handler does not exist', async () => {
            const channel = generateUuid()

            createClient.mockReturnValueOnce(redisClientPubMock)
            createClient.mockReturnValueOnce(redisClientSubMock)

            redisClientSubMock.on.mockImplementation((_event, cb) => {
                cb(channel, '{}')
            })

            const logger = new LoggerMock()
            const pubSubProvider = new PubSubProvider(config, logger)

            redisClientSubMock.subscribe.mockResolvedValue(null)

            await pubSubProvider.onceChannelMessage(channel, async () => {})
            await pubSubProvider.unsubscribe(channel)

            expect(logger.error).toHaveBeenCalledWith(`Could not find a message handler for the channel ${channel}`)
            expect(logger.info).toHaveBeenCalledWith(`Redis READ-ONLY sub connection open to ${JSON.stringify(config.readOnly.sentinels)}`)
        })
    })

    describe('method: `publish`', () => {
        it('should successfully publish message', async () => {
            const channel = generateUuid()

            createClient.mockReturnValueOnce(redisClientPubMock)
            createClient.mockReturnValueOnce(redisClientSubMock)

            const logger = new LoggerMock()
            const pubSubProvider = new PubSubProvider(config, logger)

            redisClientPubMock.publish.mockResolvedValue(1)

            expect(await pubSubProvider.publish(channel, {})).toBe(1)
        })
    })

    describe('method: `onceChannelMessage`', () => {
        it('should successfully register handler for channel and then handle received message', async () => {
            let onMessageHandler: CallableFunction = async () => {}

            const channel = generateUuid()

            createClient.mockReturnValueOnce(redisClientPubMock)
            createClient.mockReturnValueOnce(redisClientSubMock)

            redisClientSubMock.on.mockImplementation((event, cb) => {
                if (event === 'message') {
                    onMessageHandler = cb
                }
            })

            const logger = new LoggerMock()
            const pubSubProvider = new PubSubProvider(config, logger)

            redisClientSubMock.subscribe.mockResolvedValue(null)

            await pubSubProvider.onceChannelMessage(channel, async (message) => {
                expect(message).toBe('{}')
            })

            await onMessageHandler(channel, '{}')
        })

        it('should fail to register handler for channel in case it was already registered', async () => {
            const channel = generateUuid()

            createClient.mockReturnValueOnce(redisClientPubMock)
            createClient.mockReturnValueOnce(redisClientSubMock)

            const logger = new LoggerMock()
            const pubSubProvider = new PubSubProvider(config, logger)

            redisClientSubMock.subscribe.mockResolvedValue(null)

            await pubSubProvider.onceChannelMessage(channel, async () => {})

            await expect(async () => {
                await pubSubProvider.onceChannelMessage(channel, async () => {})
            }).rejects.toEqual(new Error(`Handler already exists by the provided channel ${channel}`))
        })

        it('should successfully register handler for channel and then only log error in case handler rejects', async () => {
            let onMessageHandler: CallableFunction = async () => {}

            const channel = generateUuid()
            const expectedError = new Error('Unable to handle message')

            createClient.mockReturnValueOnce(redisClientPubMock)
            createClient.mockReturnValueOnce(redisClientSubMock)

            redisClientSubMock.on.mockImplementation((event, cb) => {
                if (event === 'message') {
                    onMessageHandler = cb
                }
            })

            const logger = new LoggerMock()
            const pubSubProvider = new PubSubProvider(config, logger)

            redisClientSubMock.subscribe.mockResolvedValue(null)

            await pubSubProvider.onceChannelMessage(channel, async () => {
                throw expectedError
            })

            await onMessageHandler(channel, '{}')

            expect(logger.error).toHaveBeenCalledWith(`Failed to handle message from the channel ${channel}`, { err: expectedError })
        })
    })

    describe('method: `getStatus`', () => {
        it('should return status for both pub/sub', () => {
            createClient.mockReturnValueOnce(redisClientPubMock)
            createClient.mockReturnValueOnce(redisClientSubMock)

            redisClientPubMock.on.mockImplementationOnce((_connectEvent, cb) => {
                cb()
            })
            redisClientPubMock.on.mockImplementationOnce((_errorEvent, cb) => {
                cb(new Error('Some error'))
            })

            redisClientSubMock.on.mockImplementationOnce((_connectEvent, cb) => {
                cb()
            })
            redisClientSubMock.on.mockImplementationOnce((_errorEvent, cb) => {
                cb(new Error('Some error'))
            })

            const logger = new LoggerMock()
            const pubSubProvider = new PubSubProvider(config, logger)

            expect(pubSubProvider.getStatus()).toEqual({ pub: 'ready', sub: 'ready' })
            expect(logger.info).toHaveBeenCalledWith(
                `Redis READ-WRITE pub connection open to ${JSON.stringify(config.readWrite.sentinels)}`,
            )
            expect(logger.info).toHaveBeenCalledWith(`Redis READ-ONLY sub connection open to ${JSON.stringify(config.readOnly.sentinels)}`)
        })
    })
})
