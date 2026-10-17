'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAppShell } from '@/components/layout/AppShell'
import { TAB_ITEMS } from '@/components/layout/tabs'
import { readDraft, type Draft } from '@/hooks/round/draft'
import type { RoundRow } from '@/hooks/round/restoreRound'
import type { RoundOverview } from '@/components/my/myTypes'
import { createClient, getSignedInUser } from '@/utils/supabase/client'
import { color, palette } from '@/utils/theme'

const cardStyle = { backgroundColor: palette.white, padding: '18px', borderRadius: '12px', border: `1px solid ${palette.slate200}`, marginBottom: '14px' } as const
const primaryButton = { display: 'inline-block', padding: '10px 18px', backgroundColor: color.brand, color: palette.white, border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', textDecoration: 'none', cursor: 'pointer' } as const

// 준비 중인 탭을 한 카드에 모아 짧게 소개한다. 메뉴의 "곧 열려요" 표시와 같은 목록을 쓴다.
const COMING_SOON_NOTES: Record<string, string> = {
  '/join': '필드 조인과 스크린 벙개 모집',
  '/video': '내 기록에 맞춘 골프 영상',
  '/lesson': '레슨 프로와 연습 피드',
  '/shop': '골프용품 공동구매',
}
const COMING_SOON = TAB_ITEMS.filter((item) => item.comingSoon)

type Overview = Pick<RoundOverview, 'completed_rounds' | 'average_score' | 'best_score'>

type ServerRound = Pick<RoundRow, 'club_name' | 'golf_club' | 'course_name'>

/**
 * 이어서 기록할 라운드와 서버의 라운드 요약을 읽는다. 로그인하지 않았으면 둘 다 없다.
 * 이어서 기록할 라운드는 스코어 탭과 같은 순서로 찾는다: 이 기기의 임시 기록, 없으면 서버의 진행 중 라운드.
 * 서버 라운드는 다른 기기에서 시작했거나 이 기기의 임시 기록이 지워진 경우다.
 */
function useHomeSummary(isLoggedIn: boolean) {
  const [inProgress, setInProgress] = useState<string | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [overviewState, setOverviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  useEffect(() => {
    if (!isLoggedIn) return
    let cancelled = false
    void (async () => {
      setOverviewState('loading')
      const supabase = createClient()
      const { user, offline } = await getSignedInUser(supabase)
      if (cancelled || !user) return
      const draft = readDraft(user.id)
      setInProgress(draft ? draftDescription(draft) : null)
      // 연결이 없으면 서버에 묻지 않는다. 이 기기의 진행 중 라운드만 보여 준다.
      if (offline) { setOverviewState('error'); return }
      const [{ data, error }, serverRound] = await Promise.all([
        supabase.rpc('get_my_round_overview'),
        draft ? null : supabase.from('rounds').select('club_name,golf_club,course_name')
          .eq('user_id', user.id).eq('status', 'in_progress')
          .order('created_at', { ascending: false }).limit(1),
      ])
      if (cancelled) return
      // 진행 중 라운드를 못 읽으면 표시만 하지 않는다. 스코어 탭이 다시 확인한다.
      const round = serverRound?.data?.[0] as ServerRound | undefined
      if (round) setInProgress(serverRoundDescription(round))
      const row = (Array.isArray(data) ? data[0] : data) as Overview | null
      setOverview(error ? null : row)
      setOverviewState(error || !row ? 'error' : 'ready')
    })()
    return () => {
      cancelled = true
      setInProgress(null)
      setOverview(null)
      setOverviewState('idle')
    }
  }, [isLoggedIn])

  return { inProgress, overview, overviewState }
}

function draftDescription(draft: Draft) {
  const place = [draft.golfClubName, draft.courseName].filter(Boolean).join(' · ')
  return `${place || '골프장 미정'} · ${draft.currentHole}번 홀 진행 중`
}

function serverRoundDescription(round: ServerRound) {
  const place = [round.club_name || round.golf_club, round.course_name].filter(Boolean).join(' · ')
  return `${place || '골프장 미정'} · 진행 중인 라운드`
}

export default function HomeTab() {
  const { isLoggedIn, authLoading, userNickname, openAuthModal } = useAppShell()
  const { inProgress, overview, overviewState } = useHomeSummary(isLoggedIn)

  const heading = authLoading
    ? '오늘 라운드 준비되셨나요?'
    : isLoggedIn
      ? `${userNickname}님, 오늘 라운드 준비되셨나요?`
      : '라운드의 모든 샷을 기록해 보세요'

  return (
    <div style={{ padding: '16px' }}>
      <section style={{ backgroundColor: palette.slate900, color: palette.white, padding: '24px', borderRadius: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: palette.sky400, fontWeight: 'bold', marginBottom: '4px' }}>오늘의 골프</div>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '22px', lineHeight: 1.35, wordBreak: 'keep-all' }}>{heading}</h2>
        <p style={{ margin: 0, fontSize: '14px', color: palette.slate300, lineHeight: 1.5, wordBreak: 'keep-all' }}>
          {isLoggedIn || authLoading
            ? '샷마다 남은 거리와 클럽을 남기면 라운드가 끝난 뒤 내 기록에 맞춘 분석을 볼 수 있어요.'
            : '로그인하면 샷마다 남은 거리와 클럽을 기록하고, 라운드가 끝난 뒤 내 기록에 맞춘 분석을 볼 수 있어요.'}
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          {!isLoggedIn && !authLoading ? (
            <button type="button" onClick={openAuthModal} style={primaryButton}>로그인하고 기록 시작하기</button>
          ) : (
            <Link href="/score" style={primaryButton}>{inProgress ? '⛳ 이어서 기록하기' : '⛳ 스코어 기록 시작'}</Link>
          )}
        </div>
        {inProgress && (
          <p style={{ margin: '10px 0 0', fontSize: '13px', color: palette.slate300 }}>{inProgress}</p>
        )}
      </section>

      {isLoggedIn && (
        <section aria-labelledby="home-summary-title" style={cardStyle}>
          <h3 id="home-summary-title" style={{ margin: '0 0 10px 0', fontSize: '16px' }}>내 라운드</h3>
          {overviewState === 'loading' && <p style={{ margin: 0, fontSize: '14px', color: palette.slate500 }}>기록을 불러오는 중이에요.</p>}
          {overviewState === 'error' && <p style={{ margin: 0, fontSize: '14px', color: palette.slate500 }}>지금은 기록 요약을 불러오지 못했어요. MY 탭에서 다시 볼 수 있어요.</p>}
          {overviewState === 'ready' && overview && (overview.completed_rounds > 0 ? (
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', margin: 0, textAlign: 'center' }}>
              {[
                ['완료 라운드', `${overview.completed_rounds}회`],
                ['평균 타수', overview.average_score == null ? '-' : Number(overview.average_score).toFixed(1)],
                ['베스트', overview.best_score == null ? '-' : String(overview.best_score)],
              ].map(([label, value]) => (
                <div key={label} style={{ backgroundColor: palette.slate50, borderRadius: '8px', padding: '10px 4px' }}>
                  <dt style={{ fontSize: '12px', color: palette.slate500 }}>{label}</dt>
                  <dd style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 'bold', color: palette.slate900 }}>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p style={{ margin: 0, fontSize: '14px', color: palette.slate600, lineHeight: 1.5 }}>
              아직 등록한 라운드가 없어요. 첫 라운드를 기록하면 여기에 평균과 베스트 스코어가 보여요.
            </p>
          ))}
          <Link href="/my" style={{ display: 'inline-block', marginTop: '12px', fontSize: '14px', fontWeight: 'bold', color: color.brand }}>MY 탭에서 자세히 보기 →</Link>
        </section>
      )}

      <section aria-labelledby="home-coming-soon-title" style={cardStyle}>
        <h3 id="home-coming-soon-title" style={{ margin: '0 0 4px 0', fontSize: '16px' }}>준비 중인 서비스</h3>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: palette.slate500 }}>지금은 스코어 기록과 MY 탭을 쓸 수 있어요.</p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {COMING_SOON.map((item) => (
            <li key={item.href} style={{ borderTop: `1px solid ${palette.slate100}` }}>
              <Link href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', color: 'inherit', textDecoration: 'none' }}>
                <span aria-hidden="true" style={{ fontSize: '20px' }}>{item.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: 'bold' }}>{item.label}</span>
                  <span style={{ display: 'block', fontSize: '13px', color: palette.slate500 }}>{COMING_SOON_NOTES[item.href]}</span>
                </span>
                <span style={{ padding: '0 6px', borderRadius: '6px', background: palette.amber100, color: palette.amber800, fontSize: '11px', fontWeight: 700, lineHeight: '18px', whiteSpace: 'nowrap' }}>곧 열려요</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
