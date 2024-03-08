import { HealthCheckResult, HttpStatusCode, Logger, OnHealthCheck } from '@diia-inhouse/types'

import { MessageHandler, PubSubStatus, PubSubStatusResult } from '../interfaces/pubsub'
import { RedisConfig, RedisStatusValue } from '../interfaces/redis'

import { PubSubProvider } from './providers/pubsub'

export class PubSubService implements OnHealthCheck {
    private readonly provider: PubSubProvider

    constructor(
        private readonly redisConfig: RedisConfig,

        private readonly logger: Logger,
    ) {
        this.provider = new PubSubProvider(this.redisConfig, this.logger)
    }

    async unsubscribe(channel: string): Promise<unknown> {
        return await this.provider.unsubscribe(channel)
    }

    async publish(channel: string, data: unknown): Promise<number> {
        return await this.provider.publish(channel, data)
    }

    onceChannelMessage(channel: string, handler: MessageHandler): Promise<void> {
        return this.provider.onceChannelMessage(channel, handler)
    }

    async onHealthCheck(): Promise<HealthCheckResult<PubSubStatusResult>> {
        const pubSubStatus: PubSubStatus = this.provider.getStatus()

        const status: HttpStatusCode = Object.values(pubSubStatus).some((s) => s !== RedisStatusValue.Ready)
            ? HttpStatusCode.SERVICE_UNAVAILABLE
            : HttpStatusCode.OK

        return {
            status,
            details: { redis: pubSubStatus },
        }
    }
}
