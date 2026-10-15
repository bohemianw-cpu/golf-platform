'use client'

import { useRouter } from 'next/navigation'
import MyTab from '@/components/my/MyTab'

export default function MyPage() {
  const router = useRouter()
  return <MyTab onStartSample={(id) => router.push(`/score?sample=${encodeURIComponent(id)}`)} />
}
