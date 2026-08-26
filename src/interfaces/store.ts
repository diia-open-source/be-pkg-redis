import { StoreStatus } from './redis.js'

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

/**
 * Parsed reply of the `CL.THROTTLE` command.
 *
 * @see {@link https://www.dragonflydb.io/docs/command-reference/strings/cl.throttle | Dragonfly CL.THROTTLE}
 */
export interface ThrottleResult {
    /**
     * Whether the action must be limited, i.e. the bucket had no room for the requested quantity.
     */
    limited: boolean
    /**
     * Total limit of the key, equals `maxBurst + 1`.
     * Maps to the `X-RateLimit-Limit` header.
     */
    totalLimit: number
    /**
     * Remaining limit of the key.
     * Maps to the `X-RateLimit-Remaining` header.
     */
    remaining: number
    /**
     * Number of seconds to wait before retrying if the action was limited, otherwise `-1`.
     * Maps to the `Retry-After` header.
     */
    retryAfterSec: number
    /**
     * Number of seconds until the limit is fully restored.
     * Maps to the `X-RateLimit-Reset` header.
     */
    resetAfterSec: number
}

export type StoreStatusResult = { store: StoreStatus }
