import { RedisKey, RedisValue } from 'ioredis'

import { CacheStatus } from './redis'

export interface CacheProvider {
    get(key: RedisKey): Promise<string | null>
    set(key: RedisKey, data: RedisValue, expiration: number): Promise<string>
    getKeysByPattern(pattern: string): Promise<string[]>
    getByKeys(keys: string[]): Promise<(null | string)[]>
    remove(...key: string[]): Promise<number>
    getStatus(): CacheStatus
}

export type CacheStatusResult = { redis: CacheStatus }
