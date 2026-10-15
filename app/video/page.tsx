import type { Metadata } from 'next'
import ComingSoonTab from '@/components/layout/ComingSoonTab'

export const metadata: Metadata = { title: '골프 영상' }

export default function ComingSoonRoute() {
  return <ComingSoonTab area="video" />
}
