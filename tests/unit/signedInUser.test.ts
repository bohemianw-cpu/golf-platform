import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetLastUserId, getSignedInUser, type createClient } from '@/utils/supabase/client'

const store = new Map<string, string>()
const localStorage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key) }
const client = (session: { user: { id: string } } | null, error: { name: string } | null = null) =>
  ({ auth: { getSession: async () => ({ data: { session }, error }) } }) as unknown as ReturnType<typeof createClient>

describe('로그인한 사용자 알아내기', () => {
  let onLine = true
  beforeEach(() => {
    store.clear()
    onLine = true
    vi.stubGlobal('window', { localStorage })
    vi.stubGlobal('navigator', { get onLine() { return onLine } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('로그인 정보가 있으면 그 사용자를 돌려주고 이 기기에 기억한다', async () => {
    expect(await getSignedInUser(client({ user: { id: 'u1' } }))).toEqual({ user: { id: 'u1' }, error: null, offline: false })
    expect(store.get('golf-last-user-id')).toBe('u1')
  })

  it('연결이 없어 토큰을 못 받으면 마지막으로 로그인한 사용자를 돌려준다', async () => {
    await getSignedInUser(client({ user: { id: 'u1' } }))
    onLine = false
    expect(await getSignedInUser(client(null))).toEqual({ user: { id: 'u1' }, error: null, offline: true })
  })

  it('연결은 됐다고 나와도 토큰 요청이 네트워크 오류로 실패하면 마지막 사용자를 쓴다', async () => {
    await getSignedInUser(client({ user: { id: 'u1' } }))
    expect((await getSignedInUser(client(null, { name: 'AuthRetryableFetchError' }))).user).toEqual({ id: 'u1' })
  })

  it('연결된 상태에서 로그인 정보가 없으면 로그아웃된 것이다', async () => {
    await getSignedInUser(client({ user: { id: 'u1' } }))
    expect(await getSignedInUser(client(null))).toEqual({ user: null, error: null, offline: false })
  })

  it('로그아웃하면 기억한 사용자를 지워서, 연결이 없어도 예전 사용자로 열리지 않는다', async () => {
    await getSignedInUser(client({ user: { id: 'u1' } }))
    forgetLastUserId()
    onLine = false
    expect((await getSignedInUser(client(null))).user).toBeNull()
  })
})
