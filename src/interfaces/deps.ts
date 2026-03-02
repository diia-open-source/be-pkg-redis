import { PubSubService, RedlockService, StoreService } from '../services'

export type RedisDeps = {
    pubsub?: PubSubService
    redlock?: RedlockService
    store?: StoreService
}
