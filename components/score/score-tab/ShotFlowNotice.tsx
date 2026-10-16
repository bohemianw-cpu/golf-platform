'use client'

import { color, palette } from '@/utils/theme'

/** 스코어 탭을 처음 쓸 때 보여 주는 샷 기록 안내. 샘플 기록과 실제 기록의 차이를 알린다. */
export default function ShotFlowNotice({ onClose }: { onClose: () => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="shot-flow-notice-title" style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15,23,42,.58)', display: 'grid', placeItems: 'center', padding: 18 }}><section style={{ width: 'min(100%,420px)', padding: 20, borderRadius: 14, background: palette.white, boxShadow: '0 18px 48px rgba(15,23,42,.25)' }}><h2 id="shot-flow-notice-title" style={{ margin: '0 0 9px', fontSize: 17 }}>샷 기록 안내</h2><p style={{ margin: 0, color: palette.slate600, fontSize: 13, lineHeight: 1.7 }}>샘플 입력은 MY 탭에서 시작하며 가상 기록으로 저장되어 실제 평균과 배지·트로피에 반영되지 않습니다. 실제 샷 기록만 정식 라운드로 저장됩니다.</p><p style={{ margin: '8px 0 16px', color: palette.amber800, fontSize: 12, lineHeight: 1.6 }}>실제 기록은 유료 이용 대상이며, 현재 포인트 결제·차감 기능은 준비 중이라 지금은 포인트가 차감되지 않습니다.</p><button type="button" onClick={onClose} style={{ width: '100%', padding: 10, border: 0, borderRadius: 8, background: color.brand, color: palette.white, fontWeight: 700 }}>확인</button></section></div>
}
