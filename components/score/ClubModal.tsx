'use client'

import React, { useState } from 'react'
import { ClubItem, ClubCategory } from '@/types/golf'
import { clubButtonLabel, MAX_CLUBS, normalizeClubEntry } from '@/utils/golf/clubs'
import { sortClubs } from './ScoreTab'
import { palette } from '@/utils/theme'
import { useModalKeyboard } from '@/components/layout/useModalKeyboard'

interface ClubModalProps {
  clubs: ClubItem[]
  onClose: () => void
  onSave: (clubs: ClubItem[]) => Promise<void>
}

export default function ClubModal({ clubs, onClose, onSave }: ClubModalProps) {
  const [currentClubs, setCurrentClubs] = useState<ClubItem[]>(clubs)
  const [newClubName, setNewClubName] = useState('')
  const [newCategory, setNewCategory] = useState<ClubCategory>('iron')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // 저장 중에는 닫기 버튼처럼 Esc로도 닫지 않는다.
  const dialogRef = useModalKeyboard<HTMLDivElement>(true, isSaving ? undefined : onClose)

  const preferredApproachId = currentClubs.find((club) => club.category === 'wedge' && club.preferredApproach)?.id ?? ''
  const wedges = currentClubs.filter((club) => club.category === 'wedge')

  const handleAddClub = () => {
    if (isSaving || !newClubName.trim() || currentClubs.length >= MAX_CLUBS) return
    const newClub: ClubItem = {
      id: `custom_${Date.now()}`,
      ...normalizeClubEntry(newClubName.trim(), newCategory),
    }
    const updated = sortClubs([...currentClubs, newClub])
    setCurrentClubs(updated)
    setNewClubName('')
  }

  const handleDeleteClub = (id: string) => {
    if (isSaving) return
    setCurrentClubs(currentClubs.filter((c) => c.id !== id))
  }

  const handleSaveAndClose = async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await onSave(sortClubs(currentClubs))
      onClose()
    } catch {
      setSaveError('클럽 설정을 저장하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="club-modal-title" style={{
        backgroundColor: palette.white,
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '440px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 id="club-modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: palette.slate800 }}>
            🎒 나의 골프백 클럽 설정
          </h3>
          <button type="button" aria-label="닫기" onClick={onClose} disabled={isSaving} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: isSaving ? 'wait' : 'pointer', color: palette.slate500 }}>✕</button>
        </div>

        {/* 새 클럽 추가 영역 */}
        <div style={{ backgroundColor: palette.slate50, padding: '12px', borderRadius: '10px', marginBottom: '16px', border: `1px solid ${palette.slate200}` }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: palette.slate600, marginBottom: '8px' }}>새 클럽 추가</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <select
              aria-label="새 클럽 종류"
              disabled={isSaving}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ClubCategory)}
              style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${palette.slate300}`, fontSize: '13px', backgroundColor: palette.white }}
            >
              <option value="driver">드라이버</option>
              <option value="wood">우드</option>
              <option value="utility">유틸</option>
              <option value="iron">아이언</option>
              <option value="wedge">웨지</option>
              <option value="putter">퍼터</option>
            </select>
            <input
              type="text"
              aria-label="새 클럽 이름"
              disabled={isSaving}
              placeholder="예: 3번 우드, 5I, 58도 웨지"
              value={newClubName}
              onChange={(e) => setNewClubName(e.target.value)}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: `1px solid ${palette.slate300}`, fontSize: '13px' }}
            />
          </div>
          <button
            onClick={handleAddClub}
            disabled={isSaving || currentClubs.length >= MAX_CLUBS}
            style={{ width: '100%', padding: '8px', backgroundColor: currentClubs.length >= MAX_CLUBS ? palette.slate400 : palette.emerald500, color: palette.white, border: 'none', borderRadius: '6px', fontWeight: 600, cursor: currentClubs.length >= MAX_CLUBS ? 'not-allowed' : 'pointer', fontSize: '13px' }}
          >
            {currentClubs.length >= MAX_CLUBS ? `클럽은 최대 ${MAX_CLUBS}개까지 등록할 수 있습니다` : '+ 클럽 추가 (자동 순서 정렬)'}
          </button>
        </div>

        {/* 클럽 목록 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: palette.slate600, marginBottom: '8px' }}>
            등록된 클럽 ({currentClubs.length}개)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {currentClubs.map((club) => (
              <div
                key={club.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  backgroundColor: palette.slate100,
                  borderRadius: '20px',
                  fontSize: '13px',
                  border: `1px solid ${palette.slate300}`
                }}
              >
                <span title={club.name}>{clubButtonLabel(club)}</span>
                <button
                  type="button"
                  aria-label={`${club.name} 삭제`}
                  onClick={() => handleDeleteClub(club.id)}
                  disabled={isSaving}
                  style={{ border: 'none', background: 'none', color: palette.red500, cursor: 'pointer', fontSize: '12px', padding: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: palette.green50, padding: '12px', borderRadius: '10px', marginBottom: '20px', border: `1px solid ${palette.green200}` }}>
          <label htmlFor="preferred-approach-wedge" style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: palette.green800, marginBottom: '6px' }}>
            주로 사용하는 어프로치 웨지
          </label>
          <select
            id="preferred-approach-wedge"
            value={preferredApproachId}
            disabled={isSaving || wedges.length === 0}
            onChange={(event) => setCurrentClubs((previous) => previous.map((club) => ({
              ...club,
              preferredApproach: club.category === 'wedge' && club.id === event.target.value,
            })))}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${palette.green300}`, backgroundColor: palette.white, fontSize: '13px' }}
          >
            <option value="">{wedges.length === 0 ? '웨지를 먼저 등록해 주세요' : '선택 안 함'}</option>
            {wedges.map((club) => <option key={club.id} value={club.id}>{clubButtonLabel(club)}</option>)}
          </select>
          <p style={{ margin: '6px 0 0', fontSize: '11px', color: palette.green800 }}>70m 이하에서는 선택한 웨지를 추천합니다. 그린 위에서는 퍼터를 우선합니다.</p>
        </div>

        {/* 저장/닫기 버튼 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{ flex: 1, padding: '10px', backgroundColor: palette.slate200, color: palette.slate600, border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            취소
          </button>
          <button
            onClick={handleSaveAndClose}
            disabled={isSaving}
            style={{ flex: 1, padding: '10px', backgroundColor: palette.slate900, color: palette.white, border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isSaving ? 'wait' : 'pointer', opacity: isSaving ? 0.65 : 1 }}
          >
            {isSaving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
        {saveError && <p role="alert" style={{ margin: '8px 0 0', color: palette.red600, fontSize: '12px' }}>{saveError}</p>}
      </div>
    </div>
  )
}
