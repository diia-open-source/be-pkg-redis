import { RedisStatus } from './redis'

export interface PubSubStatus {
    pub: RedisStatus
    sub: RedisStatus
}

export type PubSubStatusResult = { redis: PubSubStatus }

export type MessageHandler = (message: string) => Promise<unknown>

export interface PubSubServiceProvider {
    unsubscribe(channel: string): Promise<unknown>
    publish(channel: string, data: unknown): Promise<number>
    onceChannelMessage(channel: string, handler: MessageHandler): Promise<void>
    getStatus(): PubSubStatus
}
