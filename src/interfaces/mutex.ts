import { RedlockMutex } from 'redis-semaphore'

export { RedlockMutex } from 'redis-semaphore'

export type Lock = RedlockMutex

export type MutexStatusResult = { mutex: string }

export type LockOptions = {
    /**
     * Time in milliseconds between acquire attempts if resource locked
     * @defaultValue 500
     */
    retryInterval?: number
    /**
     * Maximum time in milliseconds to keep trying to acquire a locked resource before giving up
     * @defaultValue ttl * 2
     */
    acquireTimeout?: number
}
