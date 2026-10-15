import type { Metadata } from 'next'
import HomeTab from '@/components/home/HomeTab'

export const metadata: Metadata = { title: '홈' }

export default function HomeRoute() {
  return <HomeTab />
}
