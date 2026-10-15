'use client'

import type { RoundApi } from '@/hooks/useRound'
import { isSelectableTee, resolveHoleTeeVariants } from '@/utils/course-tee'

export default function RoundMetrics({ round, standalone = false }: { round: RoundApi; standalone?: boolean }) {
  const { currentHole, completedHoles, summary } = round
  const currentRouteHole = round.routeHoles?.[currentHole - 1]
  const routeIndex = currentRouteHole ? round.routeIds.indexOf(currentRouteHole.route_id) : round.routeIds.length === 1 ? 0 : -1
  const currentRouteName = routeIndex >= 0 ? round.courseName.split(' → ')[routeIndex] : null
  const courseLabel = currentRouteName ?? '코스 미선택'
  const courseTees = (round.routeHoles ?? []).flatMap((hole) => hole.tees)
    .filter(isSelectableTee)
    .filter((tee, index, all) => all.findIndex((candidate) => candidate.tee_code === tee.tee_code) === index)
  const appliedTeeVariants = currentRouteHole && round.teeCode
    ? resolveHoleTeeVariants(currentRouteHole, round.teeCode, courseTees)
    : []
  const appliedTee = appliedTeeVariants.find((tee) => tee.green_code === round.greenCodes[currentHole - 1]) ?? appliedTeeVariants[0]
  const teeWasSubstituted = !!appliedTee && appliedTee.tee_code !== round.teeCode
  const teeLabel = teeWasSubstituted
    ? `${round.teeName ?? round.teeCode} → ${appliedTee.display_name}`
    : round.teeName ?? appliedTee?.display_name ?? (round.routeIds.length > 0 ? '티 미표기' : '티 미선택')
  const teeColor = appliedTee?.tee_color ?? courseTees.find((tee) => tee.tee_code === round.teeCode)?.tee_color ?? '#94a3b8'
  const totalDiff = summary.totalDiff
  const diffText = completedHoles.length === 0 || totalDiff === 0 ? '0' : totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`
  const metricLabel = { fontSize: 'clamp(8px, 2.1vw, 10px)', color: '#476e5c', fontWeight: 700, whiteSpace: 'nowrap' as const }
  const metricValue = { fontSize: '19px', fontWeight: 800, lineHeight: 1.3 }
  const metricSub = { fontSize: '9px', color: '#668675', whiteSpace: 'nowrap' as const }
  const metricCell = { display: 'grid', gridTemplateRows: '14px 26px 12px', alignContent: 'center', alignItems: 'center', justifyItems: 'center', rowGap: 3, minWidth: 0, padding: '7px 2px' } as const

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.38fr) repeat(3,minmax(0,1fr))', minHeight: 86, backgroundColor: '#eaf7ef', color: '#14532d', textAlign: 'center', borderRadius: standalone ? 12 : 0, overflow: 'hidden', marginBottom: standalone ? 8 : 0, boxShadow: standalone ? '0 4px 6px -1px rgba(0,0,0,.1)' : 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 0, padding: '7px 3px', backgroundColor: '#fff', borderRight: '1px solid #e2e8f0' }}>
        {courseLabel && <div title={courseLabel} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#047857', fontSize: '10px', fontWeight: 700 }}>{courseLabel}</div>}
        <div style={{ ...metricValue, color: '#0284c7', fontSize: '21px' }}>{currentHole}H</div>
        {teeLabel && <div title={`이번 라운드 티: ${teeLabel}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, maxWidth: '100%', minWidth: 0, color: '#475569', fontSize: '9px' }}><span aria-hidden="true" style={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', backgroundColor: teeColor }} /><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teeLabel}</span></div>}
        {!standalone && <div style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b', fontSize: '9px', fontWeight: 600 }}>{round.currentShots.length + 1}번째 샷 · 누적 {round.currentHoleScore}타</div>}
      </div>
      <div style={metricCell}>
        <div style={metricLabel}>기준파 대비</div>
        <div style={{ ...metricValue, color: totalDiff <= 0 ? '#047857' : '#dc2626' }}>{diffText}</div>
        <div aria-hidden="true" style={metricSub} />
      </div>
      <div style={{ ...metricCell, borderLeft: '1px solid #cce8d8' }}>
        <div style={metricLabel}>페어웨이 안착률</div>
        <div style={{ ...metricValue, color: '#047857' }}>{summary.fwPercent}%</div>
        <div style={metricSub}>({summary.fwHit}/{summary.fwEligible})</div>
      </div>
      <div style={{ ...metricCell, borderLeft: '1px solid #cce8d8' }}>
        <div style={metricLabel}>그린 적중률</div>
        <div style={{ ...metricValue, color: '#a16207' }}>{summary.girPercent}%</div>
        <div style={metricSub}>({summary.girCount}/{completedHoles.length})</div>
      </div>
    </div>
  )
}
