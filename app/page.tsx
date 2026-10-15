import { redirect } from 'next/navigation'

// 앱을 열면 지금처럼 스코어 기록 화면부터 보여 준다.
export default function RootPage() {
  redirect('/score')
}
