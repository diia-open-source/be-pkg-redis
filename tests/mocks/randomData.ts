import { randomBytes, randomUUID } from 'crypto'

export function generateUuid(): string {
    return randomUUID()
}

export function generateIdentifier(length = 12): string {
    return randomBytes(length).toString('hex')
}
