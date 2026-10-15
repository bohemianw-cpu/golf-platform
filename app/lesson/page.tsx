import type { Metadata } from 'next'
import ComingSoonTab from '@/components/layout/ComingSoonTab'

export const metadata: Metadata = { title: '레슨' }

export default function ComingSoonRoute() {
  return <ComingSoonTab area="lesson" />
}
