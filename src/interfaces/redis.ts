import { RedisOptions } from 'ioredis'

export { RedisOptions } from 'ioredis'

export enum RedisStatusValue {
    Ready = 'ready',
}

export type RedisStatus = RedisStatusValue | string

export interface RedisConfig {
    readWrite: RedisOptions
    readOnly: RedisOptions
    enablePubsub?: boolean
}

export interface CacheStatus {
    readWrite: RedisStatus
    readOnly: RedisStatus
}
