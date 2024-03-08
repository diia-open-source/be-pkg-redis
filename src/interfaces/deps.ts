import { CacheService, PubSubService, RedlockService, StoreService } from '../services'

export type RedisDeps = {
    cache?: CacheService
    pubsub?: PubSubService
    redlock?: RedlockService
    store?: StoreService
}
