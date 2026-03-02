/* eslint-disable unicorn/consistent-function-scoping */
import { mock } from 'vitest-mock-extended'

import Logger from '@diia-inhouse/diia-logger'
import { HttpStatusCode } from '@diia-inhouse/types'

import { PubSubService, PubSubStatus, RedisStatusValue } from '../../../src/index'
import { PubSubProvider } from '../../../src/services/providers/pubsub'
import { generateUuid } from '../../mocks/randomData'
import { config } from '../../mocks/services/pubsub'

vi.mock('../../../src/services/providers/pubsub', () => ({
    PubSubProvider: class PubSubProviderMock {
        unsubscribe(): unknown {
            return vi.fn()
        }

        publish(): unknown {
            return vi.fn()
        }

        onceChannelMessage(): unknown {
            return vi.fn()
        }

        onChannelMessage(): unknown {
            return vi.fn()
        }

        getStatus(): unknown {
            return vi.fn()
        }
    },
}))

describe('PubSubService', () => {
    const logger = mock<Logger>()
    const pubSubService = new PubSubService(config, logger)

    describe('method: `unsubscribe`', () => {
        it('should successfully unsubscribe', async () => {
            const channel = generateUuid()

            vi.spyOn(PubSubProvider.prototype, 'unsubscribe').mockResolvedValue(true)

            expect(await pubSubService.unsubscribe(channel)).toBe(true)
            expect(PubSubProvider.prototype.unsubscribe).toHaveBeenCalledWith(channel)
        })
    })

    describe('method: `publish`', () => {
        it('should successfully publish message', async () => {
            const channel = generateUuid()

            vi.spyOn(PubSubProvider.prototype, 'publish').mockResolvedValue(1)

            expect(await pubSubService.publish(channel, 'message')).toBe(1)
            expect(PubSubProvider.prototype.publish).toHaveBeenCalledWith(channel, 'message')
        })
    })

    describe('method: `onChannelMessage`', () => {
        it('should successfully publish message', async () => {
            const channel = generateUuid()
            const handler = async (): Promise<void> => {}

            vi.spyOn(PubSubProvider.prototype, 'onChannelMessage').mockResolvedValue()

            expect(await pubSubService.onChannelMessage(channel, handler)).toBeUndefined()
            expect(PubSubProvider.prototype.onChannelMessage).toHaveBeenCalledWith(channel, handler)
        })
    })

    describe('method: `onceChannelMessage`', () => {
        it('should successfully publish message', async () => {
            const channel = generateUuid()
            const handler = async (): Promise<void> => {}

            vi.spyOn(PubSubProvider.prototype, 'onceChannelMessage').mockResolvedValue()

            expect(await pubSubService.onceChannelMessage(channel, handler)).toBeUndefined()
        })
    })

    describe('method: `onHealthCheck`', () => {
        it.each([
            [
                'OK',
                {
                    status: HttpStatusCode.OK,
                    details: { pubsub: { pub: RedisStatusValue.Ready, sub: RedisStatusValue.Ready } as PubSubStatus },
                },
            ],
            [
                'SERVICE UNAVAILABLE',
                {
                    status: HttpStatusCode.SERVICE_UNAVAILABLE,
                    details: { pubsub: { pub: 'connecting' as RedisStatusValue, sub: RedisStatusValue.Ready } as PubSubStatus },
                },
            ],
        ])('should return `%s` status', async (_httpStatus, expectedStatus) => {
            vi.spyOn(PubSubProvider.prototype, 'getStatus').mockReturnValue(expectedStatus.details.pubsub)

            expect(await pubSubService.onHealthCheck()).toEqual(expectedStatus)
        })
    })
})
