import type { Metadata } from 'next'
import MyPage from '@/components/my/MyPage'

export const metadata: Metadata = { title: 'MY' }

export default function MyRoute() {
  return <MyPage />
}
