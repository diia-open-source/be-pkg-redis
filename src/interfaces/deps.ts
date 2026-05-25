import { PubSubService, RedlockService, StoreService } from '../services/index.js'

export type RedisDeps = {
    pubsub?: PubSubService
    redlock?: RedlockService
    store?: StoreService
}
