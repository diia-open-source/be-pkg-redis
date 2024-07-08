import Redis, { RedisOptions } from 'ioredis'

export const RedisService = {
    createClient(options: RedisOptions): Redis {
        const redisOptions: RedisOptions = {
            enableAutoPipelining: true,
            ...options,
        }

        return new Redis(redisOptions)
    },
}
