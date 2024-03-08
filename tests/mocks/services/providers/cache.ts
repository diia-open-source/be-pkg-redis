import { RedisConfig } from '../../../../src/interfaces/redis'

export const config: RedisConfig = {
    readOnly: { sentinels: [{ host: 'read.only.redis.sentinel' }] },
    readWrite: { sentinels: [{ host: 'read.write.redis.sentinel' }] },
}
