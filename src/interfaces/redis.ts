import { RedisOptions as IoRedisOptions } from 'ioredis'

export enum RedisMode {
    ReadWrite = 'READ-WRITE',
    ReadOnly = 'READ-ONLY',
}

export interface RedisOptions extends IoRedisOptions {
    maxRetryAttempts?: number
    initialRetryDelay?: number
    maxRetryDelay?: number
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
