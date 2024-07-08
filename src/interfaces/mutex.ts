import { RedlockMutex } from 'redis-semaphore'

export type Lock = RedlockMutex

export type MutexStatusResult = { mutex: string }
