export const MIN_PASSWORD_LENGTH = 8

const PWNED_RANGE_URL = 'https://api.pwnedpasswords.com/range/'

export type PasswordLeakResult = 'leaked' | 'clean' | 'unknown'

/** 비밀번호의 SHA-1 해시(대문자 16진수). 유출 목록 조회에만 쓴다. */
export async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** "해시 뒷부분:유출 횟수" 줄 목록에서 같은 해시가 있는지 찾는다. 횟수 0은 응답 길이를 감추는 가짜 줄이다. */
export function isSuffixListed(suffix: string, rangeBody: string): boolean {
  return rangeBody.split(/\r?\n/).some((line) => {
    const [candidate, count] = line.trim().split(':')
    return candidate?.toUpperCase() === suffix && Number(count) > 0
  })
}

/**
 * Have I Been Pwned 목록에 있는 비밀번호인지 확인한다. 비밀번호와 전체 해시는 보내지 않고
 * 해시 앞 5글자만 보내 비슷한 해시 목록을 받은 뒤 기기 안에서 비교한다.
 * 브라우저가 사전 요청(CORS preflight)을 보내지 않도록 별도 헤더 없이 단순 요청으로 보낸다.
 * 조회에 실패하면 'unknown'을 돌려준다.
 */
export async function checkPasswordLeak(password: string, fetchImpl: typeof fetch = fetch): Promise<PasswordLeakResult> {
  try {
    const hash = await sha1Hex(password)
    const response = await fetchImpl(PWNED_RANGE_URL + hash.slice(0, 5), { signal: AbortSignal.timeout(4000) })
    if (!response.ok) return 'unknown'
    return isSuffixListed(hash.slice(5), await response.text()) ? 'leaked' : 'clean'
  } catch {
    return 'unknown'
  }
}

/** 가입·재설정 비밀번호의 문제를 설명하는 문장. 문제가 없거나 유출 여부를 확인하지 못하면 null이다. */
export async function passwordProblem(password: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (password.length < MIN_PASSWORD_LENGTH) return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`
  if ((await checkPasswordLeak(password, fetchImpl)) === 'leaked') {
    return '이 비밀번호는 다른 서비스에서 유출된 적이 있는 비밀번호입니다. 다른 비밀번호를 사용해 주세요.'
  }
  return null
}
