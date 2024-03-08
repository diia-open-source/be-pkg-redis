import Redis from 'ioredis'

import { Logger } from '@diia-inhouse/types'

import { MessageHandler, PubSubServiceProvider, PubSubStatus } from '../../interfaces/pubsub'
import { RedisConfig } from '../../interfaces/redis'
import { RedisService } from '../redis'

export class PubSubProvider implements PubSubServiceProvider {
    private pub: Redis

    private sub: Redis

    private readonly handlerByChannel: Record<string, MessageHandler> = {}

    constructor(
        { readWrite, readOnly }: RedisConfig,

        private readonly logger: Logger,
    ) {
        this.pub = RedisService.createClient(readWrite)
        this.sub = RedisService.createClient({ ...readOnly, autoResubscribe: true })

        this.pub.on('connect', () => {
            this.logger.info(`Redis READ-WRITE pub connection open to ${JSON.stringify(readWrite.sentinels)}`)
        })

        this.pub.on('error', (err: Error) => {
            this.logger.error('Redis READ-WRITE pub connection error ', { err })
        })

        this.sub.on('connect', () => {
            this.logger.info(`Redis READ-ONLY sub connection open to ${JSON.stringify(readOnly.sentinels)}`)
        })

        this.sub.on('error', (err: Error) => {
            this.logger.error('Redis READ-ONLY sub connection error ', { err })
        })

        this.sub.on('message', async (channel: string, message: string) => {
            const handler = this.handlerByChannel[channel]
            if (!handler) {
                return this.logger.error(`Could not find a message handler for the channel ${channel}`)
            }

            delete this.handlerByChannel[channel]

            await this.sub.unsubscribe(channel)

            try {
                await handler(message)
            } catch (err) {
                this.logger.error(`Failed to handle message from the channel ${channel}`, { err })
            }
        })
    }

    async unsubscribe(channel: string): Promise<unknown> {
        delete this.handlerByChannel[channel]

        return await this.sub.unsubscribe(channel)
    }

    async publish(channel: string, data: unknown): Promise<number> {
        return await this.pub.publish(channel, JSON.stringify(data))
    }

    async onceChannelMessage(channel: string, handler: MessageHandler): Promise<void> {
        if (Object.keys(this.handlerByChannel).includes(channel)) {
            throw new Error(`Handler already exists by the provided channel ${channel}`)
        }

        this.handlerByChannel[channel] = handler
        await this.sub.subscribe(channel)
    }

    getStatus(): PubSubStatus {
        return {
            pub: this.pub.status,
            sub: this.sub.status,
        }
    }
}
