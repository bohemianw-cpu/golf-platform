import { describe, expect, it, vi } from 'vitest'
import { checkPasswordLeak, isSuffixListed, passwordProblem, sha1Hex } from '@/utils/password-check'

// 'password'의 SHA-1: 앞 5글자는 5BAA6, 나머지는 1E4C9B93F3F0682250B6CF8331B7EE68FD8
const PASSWORD_SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8'
const response = (body: string, ok = true) => ({ ok, text: async () => body }) as Response

describe('유출 비밀번호 확인', () => {
  it('SHA-1을 대문자 16진수로 만든다', async () => {
    expect(await sha1Hex('password')).toBe('5BAA6' + PASSWORD_SUFFIX)
  })

  it('해시 앞 5글자만 보내고 비밀번호는 보내지 않는다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(''))
    await checkPasswordLeak('password', fetchImpl)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.pwnedpasswords.com/range/5BAA6')
    expect(JSON.stringify(init)).not.toContain('password')
  })

  it('목록에 있으면 유출, 없으면 안전, 횟수 0인 가짜 줄은 무시한다', async () => {
    expect(isSuffixListed(PASSWORD_SUFFIX, `00000000000000000000000000000000001:3\r\n${PASSWORD_SUFFIX}:9545824`)).toBe(true)
    expect(isSuffixListed(PASSWORD_SUFFIX, `${PASSWORD_SUFFIX}:0`)).toBe(false)
    expect(await checkPasswordLeak('password', vi.fn().mockResolvedValue(response(`${PASSWORD_SUFFIX}:10`)))).toBe('leaked')
    expect(await checkPasswordLeak('password', vi.fn().mockResolvedValue(response('ABC:1')))).toBe('clean')
  })

  it('조회에 실패하면 알 수 없음으로 두어 가입을 막지 않는다', async () => {
    expect(await checkPasswordLeak('password', vi.fn().mockResolvedValue(response('', false)))).toBe('unknown')
    expect(await checkPasswordLeak('password', vi.fn().mockRejectedValue(new Error('offline')))).toBe('unknown')
    expect(await passwordProblem('long-enough-pass', vi.fn().mockRejectedValue(new Error('offline')))).toBeNull()
  })

  it('8자 미만과 유출된 비밀번호는 이유를 알려 준다', async () => {
    expect(await passwordProblem('short', vi.fn())).toContain('8자 이상')
    expect(await passwordProblem('password', vi.fn().mockResolvedValue(response(`${PASSWORD_SUFFIX}:10`)))).toContain('유출된 적이 있는')
  })
})
