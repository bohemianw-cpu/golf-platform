import { redirect } from 'next/navigation'

// 앱을 열면 지금처럼 스코어 기록 화면부터 보여 준다.
// 가입 확인·비밀번호 재설정 메일은 /?code=... 로 돌아오므로 쿼리를 그대로 넘겨야 로그인이 이어진다.
export default async function RootPage({ searchParams }: PageProps<'/'>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of [value].flat()) {
      if (item !== undefined) query.append(key, item)
    }
  }
  const search = query.toString()
  redirect(search ? `/score?${search}` : '/score')
}
