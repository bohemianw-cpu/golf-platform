'use client'

import React, { useState } from 'react'
import { ClubItem, ClubCategory } from '@/types/golf'
import { sortClubs } from './ScoreTab'

interface ClubModalProps {
  clubs: ClubItem[]
  isOpen: boolean
  onClose: () => void
  onSave: (clubs: ClubItem[]) => void
}

export default function ClubModal({ clubs, isOpen, onClose, onSave }: ClubModalProps) {
  const [currentClubs, setCurrentClubs] = useState<ClubItem[]>(clubs)
  const [newClubName, setNewClubName] = useState('')
  const [newCategory, setNewCategory] = useState<ClubCategory>('iron')

  if (!isOpen) return null

  const handleAddClub = () => {
    if (!newClubName.trim()) return
    const newClub: ClubItem = {
      id: `custom_${Date.now()}`,
      name: newClubName.trim(),
      category: newCategory,
    }
    const updated = sortClubs([...currentClubs, newClub])
    setCurrentClubs(updated)
    setNewClubName('')
  }

  const handleDeleteClub = (id: string) => {
    setCurrentClubs(currentClubs.filter((c) => c.id !== id))
  }

  const handleSaveAndClose = () => {
    onSave(sortClubs(currentClubs))
    onClose()
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
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '440px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>
            🎒 나의 골프백 클럽 설정
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        {/* 새 클럽 추가 영역 */}
        <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>새 클럽 추가</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ClubCategory)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
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
              placeholder="예: 7번 아이언, 58도"
              value={newClubName}
              onChange={(e) => setNewClubName(e.target.value)}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
          </div>
          <button
            onClick={handleAddClub}
            style={{ width: '100%', padding: '8px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
          >
            + 클럽 추가 (자동 순서 정렬)
          </button>
        </div>

        {/* 클럽 목록 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
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
                  backgroundColor: '#f1f5f9',
                  borderRadius: '20px',
                  fontSize: '13px',
                  border: '1px solid #cbd5e1'
                }}
              >
                <span>{club.name}</span>
                <button
                  onClick={() => handleDeleteClub(club.id)}
                  style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 저장/닫기 버튼 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            취소
          </button>
          <button
            onClick={handleSaveAndClose}
            style={{ flex: 1, padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            설정 저장
          </button>
        </div>
      </div>
    </div>
  )
}