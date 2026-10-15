import type { Metadata } from 'next'
import ScorePage from '@/components/score/ScorePage'

export const metadata: Metadata = { title: '스코어 기록' }

export default async function ScoreRoute({ searchParams }: PageProps<'/score'>) {
  const { sample } = await searchParams
  return <ScorePage sampleSessionId={typeof sample === 'string' && sample ? sample : null} />
}
