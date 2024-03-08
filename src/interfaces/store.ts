import { CacheStatus } from './redis'

export enum StoreTag {
    PublicService = 'publicService',
    PublicServiceCategory = 'publicServiceCategory',
    Faq = 'faq',
    ErrorTemplate = 'errorTemplate',
    MilitaryBondsName = 'militaryBondsName',
}

export type TagsConfig = {
    [tag in StoreTag]?: number
}

export interface TaggedStoreValue {
    data: string
    timestamp: number
    tags: StoreTag[]
}

export interface SetValueOptions {
    ttl?: number
    tags?: StoreTag[]
}

export type StoreStatusResult = { store: CacheStatus }
