import Redis, { RedisOptions as IoRedisOptions } from 'ioredis'
import { RedisOptions } from 'src/interfaces'

import { DurationMs, Logger } from '@diia-inhouse/types'

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
                if (attempts > maxRetryAttempts) {
                    logger.error(`Redis connection failed after ${maxRetryAttempts} attempts. Shutting down connection attempts.`, {
                        host,
                        port,
                        redisMode,
                    })

                    return null // Stop retrying (null instead of false)
                }

                const delay = Math.min(initialRetryDelay * Math.pow(2, attempts - 1), maxRetryDelay)

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
