import Redis from 'ioredis'

import { ServiceUnavailableError } from '@diia-inhouse/errors'
import { HealthCheckResult, HttpStatusCode, Logger, OnDestroy, OnHealthCheck } from '@diia-inhouse/types'

import { CacheStatus, RedisConfig, RedisStatusValue } from '../interfaces/redis'
import { SetValueOptions, StoreStatusResult, TaggedStoreValue, TagsConfig } from '../interfaces/store'

import { RedisService } from './redis'

export class StoreService implements OnHealthCheck, OnDestroy {
    private clientRW: Redis

    private clientRO: Redis

    private tagsKey = '_tags'

    constructor(
        private readonly storeConfig: RedisConfig,

        private readonly logger: Logger,
    ) {
        const { readWrite, readOnly } = this.storeConfig

        this.clientRW = RedisService.createClient(readWrite)
        this.clientRO = RedisService.createClient(readOnly)

        this.clientRW.on('connect', () => {
            this.logger.info(`Store READ-WRITE connection open to ${JSON.stringify(readWrite.sentinels)}`)
        })

        this.clientRW.on('error', (err: Error) => {
            this.logger.info('Store READ-WRITE connection error ', { err })
            this.logger.info(`Store Path ${JSON.stringify(readWrite.sentinels)}`)
        })

        this.clientRO.on('connect', () => {
            this.logger.info(`Store READ-ONLY connection open to ${JSON.stringify(readOnly.sentinels)}`)
        })

        this.clientRO.on('error', (err: Error) => {
            this.logger.info('Store READ-ONLY connection error ', { err })
            this.logger.info(`Store Path ${JSON.stringify(readOnly.sentinels)}`)
        })
    }

    async onHealthCheck(): Promise<HealthCheckResult<StoreStatusResult>> {
        const storeStatus: CacheStatus = {
            readWrite: this.clientRW.status,
            readOnly: this.clientRO.status,
        }

        const status: HttpStatusCode = Object.values(storeStatus).some((s) => s !== RedisStatusValue.Ready)
            ? HttpStatusCode.SERVICE_UNAVAILABLE
            : HttpStatusCode.OK

        return {
            status,
            details: { store: storeStatus },
        }
    }

    async onDestroy(): Promise<void> {
        await Promise.all([this.clientRW.quit(), this.clientRO.quit()])
    }

    async get(key: string): Promise<string | null> {
        return await this.clientRO.get(key)
    }

    async mget(...keys: string[]): Promise<(string | null)[]> {
        return await this.clientRO.mget(keys)
    }

    async hget(key: string, field: string): Promise<string | null> {
        return await this.clientRO.hget(key, field)
    }

    async hlen(key: string): Promise<number | null> {
        return await this.clientRO.hlen(key)
    }

    async hgetall(key: string): Promise<Record<string, string> | null> {
        return await this.clientRO.hgetall(key)
    }

    async hvals(key: string): Promise<string[]> {
        return await this.clientRO.hvals(key)
    }

    async hscan(key: string, cursor: number | string, count: number): Promise<{ cursor: string; elements: string[] }> {
        const [newCursor, elements] = await this.clientRO.hscan(key, cursor, 'COUNT', count)

        return { cursor: newCursor, elements }
    }

    async scan(matchPattern: string, cursor: number | string, count: number): Promise<{ cursor: string; elements: string[] }> {
        const [newCursor, elements] = await this.clientRO.scan(cursor, 'MATCH', matchPattern, 'COUNT', count)

        return { cursor: newCursor, elements }
    }

    async lrange(key: string, start: number, stop: number): Promise<string[] | null> {
        return await this.clientRO.lrange(key, start, stop)
    }

    async getUsingTags(key: string): Promise<string | null> {
        const [cachedValue, tagsValue] = await this.clientRO.mget(key, this.tagsKey)
        if (!cachedValue) {
            return null
        }

        const tagsConfig: TagsConfig = tagsValue ? JSON.parse(tagsValue) : {}

        try {
            const item: TaggedStoreValue = JSON.parse(cachedValue)
            if (Array.isArray(item?.tags)) {
                const isValid: boolean = this.validate(item, tagsConfig)
                if (isValid) {
                    return item.data
                }
            }

            return null
        } catch (err) {
            if (err instanceof Error) {
                this.logger.error('Failed when parse value with tags', { err })
            }

            throw new ServiceUnavailableError()
        }
    }

    async set(key: string, value: string, options: SetValueOptions = {}): Promise<'OK' | null> {
        const { ttl, tags } = options

        if (tags?.length) {
            value = await this.wrapValueWithMetadata(value, tags)
        }

        if (ttl) {
            return await this.clientRW.set(key, value, 'PX', ttl) // milliseconds
        }

        return await this.clientRW.set(key, value)
    }

    async hset(key: string, value: Record<string, string>): Promise<number> {
        return await this.clientRW.hset(key, value)
    }

    async lpush(key: string, ...values: string[]): Promise<number> {
        return await this.clientRW.lpush(key, ...values)
    }

    async incrby(key: string, value: number): Promise<number> {
        return await this.clientRW.incrby(key, value)
    }

    async keys(pattern: string): Promise<string[]> {
        return await this.clientRW.keys(pattern)
    }

    async remember(key: string, closure: () => Promise<string | null>, options: SetValueOptions = {}): Promise<string | null> {
        const cachedValue = await this.get(key)
        if (cachedValue) {
            return cachedValue
        }

        const result = await closure()

        await this.set(key, result || '', options)

        return result
    }

    async remove(...keys: string[]): Promise<number> {
        return await this.clientRW.del(...keys)
    }

    async hdel(key: string, ...fields: string[]): Promise<number> {
        return await this.clientRW.hdel(key, ...fields)
    }

    async expire(key: string, seconds: number): Promise<number> {
        return await this.clientRW.expire(key, seconds, 'NX')
    }

    async bumpTags(tags: string[]): Promise<'OK' | null> {
        const tagsValue = await this.clientRO.get(this.tagsKey)
        const tagsConfig: TagsConfig = tagsValue ? JSON.parse(tagsValue) : {}
        const timestamp: number = Date.now()

        for (const tagKey of tags) {
            tagsConfig[tagKey] = timestamp
        }

        return await this.clientRW.set(this.tagsKey, JSON.stringify(tagsConfig))
    }

    async flushDb(): Promise<'OK'> {
        return await this.clientRW.flushdb()
    }

    private validate({ tags, timestamp }: TaggedStoreValue, tagsConfig: TagsConfig): boolean {
        const tagTimestamps = Object.entries(tagsConfig)
            .filter(([tag]) => tags.includes(tag))
            .map(([, tagTimestamp]) => tagTimestamp)

        return tagTimestamps.every((tagTimestamp) => tagTimestamp && tagTimestamp <= timestamp)
    }

    private async wrapValueWithMetadata(data: string, tags: string[]): Promise<string> {
        const tagsValue = await this.clientRO.get(this.tagsKey)
        const tagsConfig: TagsConfig = tagsValue ? JSON.parse(tagsValue) : {}

        const tagTimestamps = Object.entries(tagsConfig)
            .filter(([tag]) => tags.includes(tag))
            .map(([, tagTimestamp]) => tagTimestamp)
            // eslint-disable-next-line unicorn/prefer-native-coercion-functions
            .filter((tagTimestamp): tagTimestamp is number => Boolean(tagTimestamp))

        const timestamp = tagTimestamps.length > 0 ? Math.max(...tagTimestamps) : 0

        const wrappedValue: TaggedStoreValue = { data, tags, timestamp }

        return JSON.stringify(wrappedValue)
    }
}
