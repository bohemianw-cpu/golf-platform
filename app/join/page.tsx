import type { Metadata } from 'next'
import ComingSoonTab from '@/components/layout/ComingSoonTab'

export const metadata: Metadata = { title: '조인·벙개' }

export default function ComingSoonRoute() {
  return <ComingSoonTab area="join" />
}
