const constructorMock = jest.fn()

class RedisMock {
    options: unknown[]

    constructor(...args: unknown[]) {
        this.options = [...args]

        constructorMock(...args)
    }
}

jest.mock('ioredis', () => RedisMock)

import { RedisService } from '../../../src/index'

describe('RedisService', () => {
    describe('method: `createClient`', () => {
        it('should successfully create redis client', () => {
            expect(RedisService.createClient({})).toEqual(new RedisMock({ enableAutoPipelining: true }))
            expect(constructorMock).toHaveBeenCalledWith({ enableAutoPipelining: true })
        })
    })
})
