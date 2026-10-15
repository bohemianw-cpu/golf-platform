import type { Metadata } from 'next'
import ComingSoonTab from '@/components/layout/ComingSoonTab'

export const metadata: Metadata = { title: '쇼핑' }

export default function ComingSoonRoute() {
  return <ComingSoonTab area="shop" />
}
