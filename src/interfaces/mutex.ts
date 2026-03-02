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
}
