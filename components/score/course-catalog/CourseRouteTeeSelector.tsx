'use client'

import { palette } from '@/utils/theme'
import { RouteDistancePreview, completeTeeOptions } from './parts'
import type { GolfCourseOption } from './parts'
import type { GolfCourseRoute } from '@/types/golf'
import type { GolfCourseTee } from '@/types/golf'

/** 고른 골프장의 코스 구간·라운드 홀 수·티 위치 선택과 홀별 거리. */
export default function CourseRouteTeeSelector({ courseId, selectedCourse, courseInfoLocked, routesLoading, catalogError, selectedCourseRoutes, routeIds, selectedHoleCount, locked, selectedRoutes, teeCode, onRoutesChange, teeOptions, hasReferenceDistance, selectedLayoutIsValid, selectedTee }: { courseId: string | null; selectedCourse: GolfCourseOption | null; courseInfoLocked: boolean; routesLoading: boolean; catalogError: boolean; selectedCourseRoutes: GolfCourseRoute[]; routeIds: string[]; selectedHoleCount: number; locked: boolean; selectedRoutes: GolfCourseRoute[]; teeCode: string | null; onRoutesChange: (routes: GolfCourseRoute[], teeCode: string | null, teeName: string | null) => void; teeOptions: GolfCourseTee[]; hasReferenceDistance: boolean; selectedLayoutIsValid: boolean; selectedTee: GolfCourseTee | null }) {
  return (
    <>
      {courseId && selectedCourse && !courseInfoLocked && (
        <div style={{ marginTop: '8px', padding: '9px', background: palette.green50, borderRadius: '8px', border: `1px solid ${palette.green200}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: palette.green800 }}>{selectedCourse.name} · 카탈로그 검증됨</div>
          </div>
          {routesLoading ? <p role="status" style={{ margin: '6px 0 0', fontSize: '11px', color: palette.slate500 }}>코스 정보를 불러오는 중…</p>
            : catalogError ? <p role="alert" style={{ margin: '6px 0 0', fontSize: '11px', color: palette.red700 }}>코스 레이아웃을 불러오지 못했습니다.</p>
              : selectedCourseRoutes.length > 0 ? (
                <>
                <fieldset style={{ margin: '8px 0 0', padding: '7px 8px', border: `1px solid ${palette.green200}`, borderRadius: '6px', background: palette.white }}>
                  <legend style={{ padding: '0 3px', fontSize: '10px', fontWeight: 700, color: palette.green800 }}>오늘 플레이할 코스와 티 선택</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedCourseRoutes.map((route) => {
                      const routeUseCount = routeIds.filter((id) => id === route.id).length
                      const checked = routeUseCount > 0
                      const cannotAdd = !checked && selectedHoleCount + route.hole_count > 18
                      const canRepeat = checked && selectedHoleCount + route.hole_count <= 18
                      const isNineHoleChoice = selectedCourse.hole_count === 9 && selectedCourseRoutes.length === 1 && route.hole_count === 9
                      return <div key={route.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: palette.slate700 }}>
                          <input type="checkbox" checked={checked} disabled={locked || cannotAdd} onChange={() => {
                            const next = [...selectedRoutes]
                            if (checked) {
                              const remaining = next.filter((item) => item.id !== route.id)
                              const options = completeTeeOptions(remaining, remaining.reduce((sum, item) => sum + item.hole_count, 0))
                              const retained = options.find((item) => item.tee_code === teeCode) ?? null
                              onRoutesChange(remaining, retained?.tee_code ?? null, retained?.display_name ?? null)
                              return
                            }
                            else next.push(route)
                            const options = completeTeeOptions(next, next.reduce((sum, item) => sum + item.hole_count, 0))
                            const retained = options.find((item) => item.tee_code === teeCode) ?? null
                            onRoutesChange(next, retained?.tee_code ?? null, retained?.display_name ?? null)
                          }} aria-label={`${route.display_name} ${route.hole_count}홀 코스`} />
                          {route.display_name} ({route.hole_count}홀{routeUseCount > 1 ? ` · ${routeUseCount}회 선택` : ''})
                        </label>
                        {canRepeat && !isNineHoleChoice && <button type="button" disabled={locked} aria-label={`${route.display_name} 코스 ${route.hole_count}홀 추가 반복`} onClick={() => {
                          const next = [...selectedRoutes, route]
                          const options = completeTeeOptions(next, next.reduce((sum, item) => sum + item.hole_count, 0))
                          const retained = options.find((item) => item.tee_code === teeCode) ?? null
                          onRoutesChange(next, retained?.tee_code ?? null, retained?.display_name ?? null)
                        }} style={{ padding: '3px 6px', border: `1px solid ${palette.green200}`, borderRadius: '5px', background: palette.green50, color: palette.green800, fontSize: '10px', cursor: locked ? 'not-allowed' : 'pointer' }}>+{route.hole_count}홀 반복</button>}
                      </div>
                    })}
                  </div>
                  {selectedCourse.hole_count === 9 && selectedCourseRoutes.length === 1 && selectedCourseRoutes[0].hole_count === 9 && selectedRoutes.length > 0 && selectedRoutes.every((route) => route.id === selectedCourseRoutes[0].id) && (
                    <fieldset style={{ display: 'flex', gap: '14px', margin: '8px 0 0', padding: '6px 8px', border: `1px solid ${palette.slate300}`, borderRadius: '6px' }}>
                      <legend style={{ fontSize: '10px', fontWeight: 700 }}>라운드 홀 수</legend>
                      {[9, 18].map((count) => <label key={count} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                        <input type="radio" name="course-hole-count" value={count} checked={selectedHoleCount === count} disabled={locked} onChange={() => {
                          const next = Array.from({ length: count / 9 }, () => selectedCourseRoutes[0])
                          onRoutesChange(next, null, null)
                        }} />
                        {count === 18 ? `18홀 (${selectedCourseRoutes[0].display_name} 2회)` : '9홀'}
                      </label>)}
                    </fieldset>
                  )}
                  <div style={{ marginTop: '5px', fontSize: '10px', color: palette.slate500 }}>
                    선택 순서: {selectedRoutes.length ? selectedRoutes.map((route) => route.display_name).join(' → ') : '미선택'}
                  </div>
                  {selectedHoleCount > 0 && selectedHoleCount <= 18 && (teeOptions.length > 0 ? (
                    <fieldset style={{ margin: '8px 0 0', padding: '6px 8px', border: `1px solid ${palette.slate300}`, borderRadius: '6px' }}>
                      <legend style={{ fontSize: '10px', fontWeight: 700 }}>이번 라운드 티 위치 (필수)</legend>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {teeOptions.map((tee) => <label key={tee.tee_code} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
                          <input type="radio" name="course-tee" value={tee.tee_code} checked={teeCode === tee.tee_code} disabled={locked} onChange={() => onRoutesChange(selectedRoutes, tee.tee_code, tee.display_name)} />
                          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', border: `1px solid ${palette.slate500}`, background: tee.tee_color }} />
                          {tee.display_name}
                        </label>)}
                      </div>
                      <p style={{ margin: '5px 0 0', fontSize: '10px', color: palette.slate500 }}>선택한 티 거리가 없는 홀은 한 단계 높은 티로 자동 적용됩니다.</p>
                    </fieldset>
                  ) : hasReferenceDistance
                    ? <p role="status" style={{ margin: '6px 0 0', fontSize: '10px', color: palette.slate600 }}>공식 기준 거리는 있으나 티 위치는 공개되지 않았습니다. 기준 거리로 기록하며 티 위치는 선택하지 않습니다.</p>
                    : <p role="status" style={{ margin: '6px 0 0', fontSize: '10px', color: palette.amber700 }}>선택한 {selectedHoleCount}홀 전체에 공통 티별 거리 자료가 없습니다.</p>)}
                  <div role="status" style={{ marginTop: '5px', fontSize: '10px', color: selectedLayoutIsValid ? palette.green700 : palette.amber700 }}>
                    {selectedLayoutIsValid ? `${selectedHoleCount}홀 파·거리 확인 완료 · ${selectedTee?.display_name ?? '공식 기준 거리 (티 미표기)'}` : selectedHoleCount === 0 ? '기록할 코스를 선택해 주세요.' : selectedHoleCount > 18 ? '라운드 기록은 최대 18홀까지 선택할 수 있습니다.' : teeOptions.length > 0 ? '기록을 시작하기 전에 티 위치를 선택해 주세요.' : '선택한 홀 전체에 확인된 파·거리 자료가 있는 코스를 선택해 주세요.'}
                  </div>
                </fieldset>
                {selectedRoutes.map((route, index) => <RouteDistancePreview key={`${route.id}-${index}`} route={route} selectedTeeCode={teeCode} courseTees={teeOptions} />)}
                </>
              ) : <p style={{ margin: '6px 0 0', fontSize: '11px', color: palette.slate500 }}>검증된 코스 레이아웃이 아직 등록되지 않았습니다.</p>}
        </div>
      )}
    </>
  )
}
