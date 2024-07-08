/* eslint-disable unicorn/consistent-function-scoping */
const pubSubProviderMock = {
    unsubscribe: jest.fn(),
    publish: jest.fn(),
    onceChannelMessage: jest.fn(),
    onChannelMessage: jest.fn(),
    getStatus: jest.fn(),
}

class PubSubProviderMock {
    unsubscribe(...args: unknown[]): unknown {
        return pubSubProviderMock.unsubscribe(...args)
    }

    publish(...args: unknown[]): unknown {
        return pubSubProviderMock.publish(...args)
    }

    onceChannelMessage(...args: unknown[]): unknown {
        return pubSubProviderMock.onceChannelMessage(...args)
    }

    onChannelMessage(...args: unknown[]): unknown {
        return pubSubProviderMock.onChannelMessage(...args)
    }

    getStatus(...args: unknown[]): unknown {
        return pubSubProviderMock.getStatus(...args)
    }
}

jest.mock('@services/providers/pubsub', () => ({ PubSubProvider: PubSubProviderMock }))

import Logger from '@diia-inhouse/diia-logger'
import { mockClass } from '@diia-inhouse/test'
import { HttpStatusCode } from '@diia-inhouse/types'

import { PubSubService, PubSubStatus, RedisStatusValue } from '../../../src/index'
import { generateUuid } from '../../mocks/randomData'
import { config } from '../../mocks/services/pubsub'

const LoggerMock = mockClass(Logger)

describe('PubSubService', () => {
    const logger = new LoggerMock()
    const pubSubService = new PubSubService(config, logger)

    describe('method: `unsubscribe`', () => {
        it('should successfully unsubscribe', async () => {
            const channel = generateUuid()

            pubSubProviderMock.unsubscribe.mockResolvedValue(true)

            expect(await pubSubService.unsubscribe(channel)).toBe(true)
            expect(pubSubProviderMock.unsubscribe).toHaveBeenCalledWith(channel)
        })
    })

    describe('method: `publish`', () => {
        it('should successfully publish message', async () => {
            const channel = generateUuid()

            pubSubProviderMock.publish.mockResolvedValue(1)

            expect(await pubSubService.publish(channel, 'message')).toBe(1)
            expect(pubSubProviderMock.publish).toHaveBeenCalledWith(channel, 'message')
        })
    })

    describe('method: `onChannelMessage`', () => {
        it('should successfully publish message', async () => {
            const channel = generateUuid()
            const handler = async (): Promise<void> => {}

            pubSubProviderMock.onChannelMessage.mockResolvedValue(true)

            expect(await pubSubService.onChannelMessage(channel, handler)).toBe(true)
            expect(pubSubProviderMock.onChannelMessage).toHaveBeenCalledWith(channel, handler)
        })
    })

    describe('method: `onceChannelMessage`', () => {
        it('should successfully publish message', async () => {
            const channel = generateUuid()
            const handler = async (): Promise<void> => {}

            pubSubProviderMock.onceChannelMessage.mockResolvedValue(true)

            expect(await pubSubService.onceChannelMessage(channel, handler)).toBe(true)
            expect(pubSubProviderMock.onceChannelMessage).toHaveBeenCalledWith(channel, handler)
        })
    })

    describe('method: `onHealthCheck`', () => {
        it.each([
            [
                'OK',
                {
                    status: HttpStatusCode.OK,
                    details: { pubsub: <PubSubStatus>{ pub: RedisStatusValue.Ready, sub: RedisStatusValue.Ready } },
                },
            ],
            [
                'SERVICE UNAVAILABLE',
                {
                    status: HttpStatusCode.SERVICE_UNAVAILABLE,
                    details: { pubsub: <PubSubStatus>{ pub: <RedisStatusValue>'connecting', sub: RedisStatusValue.Ready } },
                },
            ],
        ])('should return `%s` status', async (_httpStatus, expectedStatus) => {
            pubSubProviderMock.getStatus.mockReturnValue(expectedStatus.details.pubsub)

            expect(await pubSubService.onHealthCheck()).toEqual(expectedStatus)
        })
    })
})
