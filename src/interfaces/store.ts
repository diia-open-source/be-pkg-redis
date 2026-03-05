import { StoreStatus } from './redis'

export type TagsConfig = {
    [tag in string]?: number
}

export interface TaggedStoreValue {
    data: string
    timestamp: number
    tags: string[]
}

export interface SetValueOptions {
    /**
     * Time to live in milliseconds.
     * If not set, the key will be permanent.
     */
    ttl?: number
    /**
     * Tags associated with the value.
     */
    tags?: string[]
}

export interface ThrottleResult {
    limited: boolean
    totalLimit: number
    remaining: number
    retryAfterSec: number
    resetAfterSec: number
}

export type StoreStatusResult = { store: StoreStatus }
