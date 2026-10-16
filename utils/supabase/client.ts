import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function createClient() {
  if (!url || !key) {
    throw new Error(
      'Supabase 환경변수가 없습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 를 넣어주세요.'
    )
  }
  return createBrowserClient(url, key)
}
/**
 * 브라우저에 저장된 로그인 정보로 현재 사용자를 돌려준다. 인증 서버에 따로 묻지 않아 getUser()보다 빠르다.
 * 화면에서 사용자 id를 알아낼 때만 쓴다. 데이터 접근은 DB 행 보안 규칙이 토큰으로 다시 확인한다.
 * 서버(API 라우트, 미들웨어)에서는 토큰을 검증하는 getUser()를 써야 한다.
 */
export async function getSignedInUser(supabase: ReturnType<typeof createClient>) {
  const { data: { session }, error } = await supabase.auth.getSession()
  return { user: session?.user ?? null, error }
}
