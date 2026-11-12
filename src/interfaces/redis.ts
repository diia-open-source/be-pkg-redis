import { RedisOptions as IoRedisOptions } from 'ioredis'

export enum RedisMode {
    ReadWrite = 'READ-WRITE',
    ReadOnly = 'READ-ONLY',
}

/**
 * ioredis options extended with package-specific fields.
 *
 * The package installs its own `retryStrategy`, `reconnectOnError`, `keepAlive` and `enableAutoPipelining` defaults.
 * Because the remaining ioredis options are applied last, passing any of these explicitly replaces the package default.
 */
export interface RedisOptions extends IoRedisOptions {
    /**
     * Number of failed connection attempts after which the client is considered to be in a prolonged outage.
     * It does NOT stop reconnecting: the client keeps retrying indefinitely, and only the logging changes
     * (attempts up to this number are logged at debug level, later ones as an error, rate limited).
     *
     * @default 10
     */
    maxRetryAttempts?: number

    /**
     * Base reconnect delay in milliseconds. The backoff doubles on every attempt (`initialRetryDelay * 2^(attempt - 1)`)
     * and is capped at `maxRetryDelay` before jitter is applied.
     *
     * @default 1000
     */
    initialRetryDelay?: number

    /**
     * Upper bound in milliseconds for the backoff before jitter. Jitter adds a random 0-100% on top,
     * so the actual delay is between `maxRetryDelay` and `2 * maxRetryDelay` once the cap is reached.
     *
     * @default 10000
     */
    maxRetryDelay?: number

    /**
     * Role of the connection, used only as a log field to tell read-write and read-only clients apart.
     * It is not sent to Redis and does not change the client's behavior.
     */
    redisMode?: RedisMode
}

export enum RedisStatusValue {
    Ready = 'ready',
}

export type RedisStatus = RedisStatusValue | string

export interface RedisConfig {
    readWrite: RedisOptions
    readOnly: RedisOptions
    enablePubsub?: boolean
}

export interface StoreStatus {
    readWrite: RedisStatus
    readOnly: RedisStatus
}
