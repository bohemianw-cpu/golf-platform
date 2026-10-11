'use client'

type ComingSoonArea = 'join' | 'video' | 'lesson' | 'shop'

const CONTENT: Record<ComingSoonArea, { title: string; description: string; icon: string }> = {
  join: { title: '조인·벙개', description: '라운드 기록과 골퍼 프로필을 바탕으로 안전한 동반자 찾기를 준비하고 있습니다.', icon: '🤝' },
  video: { title: '골프 영상', description: '내 샷 데이터와 연습 과제를 연결하는 맞춤 영상 서비스를 준비하고 있습니다.', icon: '🎬' },
  lesson: { title: '레슨', description: '기록에서 발견한 개선점을 실제 연습과 전문가 레슨으로 연결할 예정입니다.', icon: '🏌️' },
  shop: { title: '쇼핑', description: '검증된 상품과 투명한 혜택을 제공할 수 있도록 준비하고 있습니다.', icon: '🛍️' },
}

export default function ComingSoonTab({ area, onGoToScore }: { area: ComingSoonArea; onGoToScore: () => void }) {
  const content = CONTENT[area]
  return (
    <section aria-labelledby="coming-soon-title" style={{ maxWidth: '720px', margin: '48px auto', padding: '32px 24px', textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', boxShadow: '0 12px 32px #0f172a0a' }}>
      <div aria-hidden="true" style={{ width: '64px', height: '64px', display: 'grid', placeItems: 'center', margin: '0 auto 16px', borderRadius: '20px', background: '#ecfdf5', fontSize: '30px' }}>{content.icon}</div>
      <p style={{ margin: '0 0 8px', color: '#047857', fontSize: '12px', fontWeight: 800, letterSpacing: '0.12em' }}>COMING SOON</p>
      <h1 id="coming-soon-title" style={{ margin: '0 0 10px', color: '#0f172a', fontSize: '24px' }}>{content.title} 서비스 준비 중</h1>
      <p style={{ maxWidth: '480px', margin: '0 auto', color: '#64748b', fontSize: '14px', lineHeight: 1.7 }}>{content.description}</p>
      <button type="button" onClick={onGoToScore} style={{ marginTop: '22px', padding: '11px 18px', color: '#fff', background: '#047857', border: 0, borderRadius: '9px', fontWeight: 700, cursor: 'pointer' }}>스코어 기록 계속하기</button>
    </section>
  )
}
