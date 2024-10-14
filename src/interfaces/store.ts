import { CacheStatus } from './redis'

export type TagsConfig = {
    [tag in string]?: number
}

export interface TaggedStoreValue {
    data: string
    timestamp: number
    tags: string[]
}

export interface SetValueOptions {
    ttl?: number
    tags?: string[]
}

export type StoreStatusResult = { store: CacheStatus }
