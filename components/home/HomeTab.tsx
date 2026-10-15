'use client'

import Link from 'next/link'
import { useAppShell } from '@/components/layout/AppShell'

const cardStyle = { display: 'block', backgroundColor: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'left', color: 'inherit', textDecoration: 'none' } as const

export default function HomeTab() {
  const { userNickname } = useAppShell()
  return (
    <div style={{ padding: '16px' }}>
      <div style={{ backgroundColor: '#0f172a', color: '#fff', padding: '24px', borderRadius: '16px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}>TODAY&apos;S GOLF BRIEFING</div>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '22px' }}>{userNickname}님, 오늘 라운드 준비되셨나요?</h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: 1.5 }}>
          라운드와 모든 샷 기록을 쌓고, 내 데이터에 맞춘 분석과 연습 방향을 확인하세요.
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          <Link
            href="/score"
            style={{ padding: '10px 18px', backgroundColor: '#047857', color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', textDecoration: 'none' }}
          >
            ⛳ 실시간 스코어 기록
          </Link>
          <Link
            href="/join"
            style={{ padding: '10px 18px', backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #38bdf8', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', textDecoration: 'none' }}
          >
            👥 조인·벙개 (서비스 준비 중)
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        <Link href="/join" style={cardStyle}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>👥</div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>필드 조인 & 스크린 벙개</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>곧 서비스가 시작됩니다.</p>
        </Link>
        <Link href="/video" style={cardStyle}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎬</div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>골프 영상 & 레슨 피드</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>데이터와 연결되는 맞춤 영상 서비스를 준비하고 있습니다.</p>
        </Link>
        <Link href="/shop" style={cardStyle}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔥</div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>골프용품 공동구매</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>곧 서비스를 시작할 예정입니다.</p>
        </Link>
      </div>
    </div>
  )
}
