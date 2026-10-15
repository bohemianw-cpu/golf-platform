import { describe, expect, it, vi } from 'vitest'
import { buildClientErrorReport, createErrorReporter, reportPath } from '@/utils/error-report'

describe('오류 보고 만들기', () => {
  it('경로의 쿼리와 해시를 버린다', () => {
    expect(reportPath('/score?code=email-link-code&type=recovery')).toBe('/score')
    expect(reportPath('/my#section')).toBe('/my')
    expect(reportPath('')).toBe('/')
  })

  it('메시지와 코드 위치의 이메일을 가린다', () => {
    const error = new Error('가입 실패: golfer.kim@example.com 계정')
    error.stack = 'Error: golfer.kim@example.com\n    at signUp (AuthModal.tsx:48)'
    const report = buildClientErrorReport('error', error, '/home')
    expect(report.message).toBe('가입 실패: [이메일] 계정')
    expect(report.stack).toContain('[이메일]')
    expect(report.stack).not.toContain('example.com')
  })

  it('길이를 자르고, Error가 아닌 값도 글로 바꾼다', () => {
    expect(buildClientErrorReport('error', 'x'.repeat(900), '/').message).toHaveLength(500)
    expect(buildClientErrorReport('unhandledrejection', { code: 42 }, '/').message).toBe('{"code":42}')
    expect(buildClientErrorReport('error', '   ', '/').message).toBe('(빈 메시지)')
    expect(buildClientErrorReport('render', new Error('x'), '/', 'd'.repeat(150)).digest).toHaveLength(100)
  })
})

describe('오류 보내기', () => {
  it('같은 오류는 한 번만, 최대 개수까지만 보낸다', () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const report = createErrorReporter(send, 2)
    const first = buildClientErrorReport('error', new Error('A'), '/score')
    expect(report(first)).toBe(true)
    expect(report(first)).toBe(false)
    expect(report(buildClientErrorReport('error', new Error('B'), '/score'))).toBe(true)
    expect(report(buildClientErrorReport('error', new Error('C'), '/score'))).toBe(false)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('보내기에 실패해도 오류를 다시 던지지 않는다', async () => {
    const report = createErrorReporter(() => Promise.reject(new Error('network')))
    expect(report(buildClientErrorReport('error', new Error('A'), '/'))).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
