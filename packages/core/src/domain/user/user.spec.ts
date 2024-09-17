import { mockCookie } from '../../../test'
import { display } from '../../tools/display'
import {
  checkUser,
  generateAnonymousId,
  getAnonymousIdFromStorage,
  sanitizeUser,
  setAnonymousIdInStorage,
} from './user'
import type { User } from './user.types'

describe('sanitize user function', () => {
  it('should sanitize a user object', () => {
    const obj = { id: 42, name: true, email: null }
    const user = sanitizeUser(obj)

    expect(user).toEqual({ id: '42', name: 'true', email: 'null' })
  })

  it('should not mutate the original data', () => {
    const obj = { id: 42, name: 'test', email: null }
    const user = sanitizeUser(obj)

    expect(user.id).toEqual('42')
    expect(obj.id).toEqual(42)
  })
})

describe('check user function', () => {
  it('should only accept valid user objects', () => {
    spyOn(display, 'error')

    const obj: any = { id: 42, name: true, email: null } // Valid, even though not sanitized
    const user: User = { id: '42', name: 'John', email: 'john@doe.com' }
    const undefUser: any = undefined
    const nullUser: any = null
    const invalidUser: any = 42

    expect(checkUser(obj)).toBe(true)
    expect(checkUser(user)).toBe(true)
    expect(checkUser(undefUser)).toBe(false)
    expect(checkUser(nullUser)).toBe(false)
    expect(checkUser(invalidUser)).toBe(false)
    expect(display.error).toHaveBeenCalledTimes(3)
  })
})

describe('check anonymous id storage functions', () => {
  const sessionStoreStrategyType = 'Cookie'

  it('should generate a random anonymous id', () => {
    const id = generateAnonymousId()
    expect(id).toMatch(/^[a-z0-9]+$/)
  })

  it('should set and get an anonymous id from cookie', () => {
    const device = 'abc'
    mockCookie()
    setAnonymousIdInStorage(sessionStoreStrategyType, device)

    expect(getAnonymousIdFromStorage()).toBe(device)
  })

  it('should set and get an anonymous id from local storage', () => {
    const device = 'abc'
    localStorage.setItem('device', device)
    setAnonymousIdInStorage('LocalStorage', device)

    expect(getAnonymousIdFromStorage()).toBe(device)
  })
})
