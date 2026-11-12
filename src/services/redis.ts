import { Redis, RedisOptions as IoRedisOptions } from 'ioredis'

import { DurationMs, Logger } from '@diia-inhouse/types'

import { RedisOptions } from '../interfaces/index.js'

/** Once the retry budget is exhausted, the "connection failed" error is logged on the first attempt past it and then on every Nth attempt. */
const EXHAUSTED_RETRY_LOG_INTERVAL = 20

export const RedisService = {
    createClient(extendedRedisOptions: RedisOptions, logger: Logger): Redis {
        const {
            maxRetryAttempts = 10,
            initialRetryDelay = DurationMs.Second,
            maxRetryDelay = DurationMs.Second * 10,
            ...options
        } = extendedRedisOptions

        const { host, port, redisMode } = options

        const redisOptions: IoRedisOptions = {
            keepAlive: DurationMs.Second * 10,
            enableAutoPipelining: true,
            reconnectOnError: (err) => {
                logger.error('Redis error detected due:', { err, host, port, redisMode })

                const targetError = 'READONLY'
                if (err.message.includes(targetError)) {
                    // Force reconnect and resend the failed command after reconnection
                    // https://github.com/redis/ioredis?tab=readme-ov-file#reconnect-on-error
                    logger.warn('Redis encountered READONLY error, forcing reconnect', { host, port, redisMode })

                    return 2
                }

                return false
            },
            retryStrategy: (attempts) => {
                const backoff = Math.min(initialRetryDelay * Math.pow(2, attempts - 1), maxRetryDelay)
                // nosemgrep: nodejs_scan.javascript-crypto-rule-node_insecure_random_generator
                const delay = Math.round(backoff + Math.random() * backoff)

                if (attempts > maxRetryAttempts) {
                    if (attempts === maxRetryAttempts + 1 || attempts % EXHAUSTED_RETRY_LOG_INTERVAL === 0) {
                        logger.error(`Redis connection failed after ${attempts} attempts. Retrying in ${delay}ms...`, {
                            host,
                            port,
                            redisMode,
                        })
                    }

                    return delay
                }

                logger.debug(`Redis connection attempt ${attempts} failed. Retrying in ${delay}ms...`, {
                    host,
                    port,
                    redisMode,
                })

                return delay
            },
            ...options,
        }

        const client = new Redis(redisOptions)

        client.on('ready', () => {
            logger.debug('Redis client is ready to accept commands', { host, port, redisMode })
        })

        client.on('close', () => {
            logger.debug('Redis connection closed', { host, port, redisMode })
        })

        client.on('reconnecting', (timeToReconnect: number) => {
            logger.debug(`Redis client is reconnecting in ${timeToReconnect}ms`, { host, port, redisMode })
        })

        client.on('end', () => {
            logger.debug('Redis connection ended, no more reconnection attempts will be made', { host, port, redisMode })
        })

        client.on('wait', () => {
            logger.debug('Redis client is waiting to reconnect', { host, port, redisMode })
        })

        return client
    },
}
