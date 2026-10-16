'use client'

import { palette } from '@/utils/theme'
import type { GolfCourseOption } from './parts'
import type { Dispatch, SetStateAction } from 'react'
import type { RefObject } from 'react'

/** 골프장 검색 결과 목록. 검색창 아래에 떠 있는 목록으로 그린다. */
export default function CourseSearchResults({ searchAnchorRect, loading, catalogError, courses, playMode, locked, onSearchOpenChange, defaultRepeatAppliedCourseId, setSelectedCourse, onCourseSelect, onSearchQueryChange, courseId, screenProvider }: { searchAnchorRect: { left: number; top: number; width: number; maxHeight: number; }; loading: boolean; catalogError: boolean; courses: GolfCourseOption[]; playMode: "field" | "screen" | null; locked: boolean; onSearchOpenChange: (open: boolean) => void; defaultRepeatAppliedCourseId: RefObject<string | null>; setSelectedCourse: Dispatch<SetStateAction<GolfCourseOption | null>>; onCourseSelect: (course: GolfCourseOption | null) => void; onSearchQueryChange: (query: string) => void; courseId: string | null; screenProvider: string | null }) {
  return (
    <>
      <ul id="course-catalog-results" aria-label="골프장 검색 결과" style={{ position: 'fixed', top: searchAnchorRect.top, left: searchAnchorRect.left, width: searchAnchorRect.width, maxHeight: searchAnchorRect.maxHeight, overflowY: 'auto', overscrollBehavior: 'contain', margin: 0, padding: '4px', listStyle: 'none', background: palette.white, border: `1px solid ${palette.slate300}`, borderRadius: '0 0 8px 8px', boxShadow: `0 8px 20px ${palette.slate900A10}`, zIndex: 1000 }}>
        {loading ? <li role="status" style={{ padding: '9px', fontSize: '12px', color: palette.slate500 }}>검색 중…</li>
          : catalogError ? <li role="alert" style={{ padding: '9px', fontSize: '12px', color: palette.red700 }}>구장 카탈로그를 불러오지 못했습니다.</li>
            : courses.length === 0 ? <li style={{ padding: '9px', fontSize: '12px', color: palette.slate500 }}>{playMode === 'screen' ? '이 서비스에 등록된 검증된 스크린 코스가 없습니다.' : '검증된 필드 골프장이 없습니다.'}</li>
              : courses.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    data-course-option="true"
                    disabled={locked}
                    onMouseDown={(event) => event.preventDefault()}
                    onKeyDown={(event) => {
                      const options = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-course-option="true"]:not(:disabled)'))
                      const index = options.indexOf(event.currentTarget)
                      if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        options[index + 1]?.focus()
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        if (index === 0) document.getElementById('course-catalog-search')?.focus()
                        else options[index - 1]?.focus()
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        onSearchOpenChange(false)
                        const input = document.getElementById('course-catalog-search')
                        if (input) {
                          input.dataset.skipOpenOnFocus = 'true'
                          input.focus()
                        }
                      }
                    }}
                    onClick={() => { defaultRepeatAppliedCourseId.current = null; setSelectedCourse(course); onCourseSelect(course); onSearchQueryChange(''); onSearchOpenChange(false) }}
                    style={{ width: '100%', padding: '9px', border: 0, borderRadius: '6px', textAlign: 'left', background: course.id === courseId ? palette.mint50 : palette.white, cursor: 'pointer' }}
                  >
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: palette.slate900 }}>{course.name}</span>
                    <span style={{ display: 'block', marginTop: '2px', fontSize: '10px', color: palette.slate500 }}>
                      {course.region || '지역 미등록'} · {playMode === 'screen' ? `스크린 · ${screenProvider}` : '필드'}
                    </span>
                  </button>
                </li>
              ))}
      </ul>
    </>
  )
}
