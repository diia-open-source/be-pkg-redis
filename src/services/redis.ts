import Redis, { RedisOptions } from 'ioredis'

export class RedisService {
    static createClient(options: RedisOptions): Redis {
        const redisOptions: RedisOptions = {
            enableAutoPipelining: true,
            ...options,
        }

        return new Redis(redisOptions)
    }
}
