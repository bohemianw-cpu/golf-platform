'use client'

import { useEffect, useState } from 'react'
import { createClient, getSignedInUser } from '@/utils/supabase/client'
import { palette } from '@/utils/theme'

type PassRow = { id: string; product_code: string; status: string; issued_at: string; expires_at: string | null }
type PointRow = { id: string; event_type: string; points_delta: number; created_at: string }
type OrderRow = { id: string; product_title: string; paid_amount_krw: number; point_discount_krw: number; status: string; created_at: string }

const card = { padding: 16, border: `1px solid ${palette.sage200}`, borderRadius: 12, background: palette.white } as const
const names: Record<string, string> = { ROUND_9: '9홀', ROUND_12: '12홀', ROUND_18: '18홀' }
const pointNames: Record<string, string> = {
  referral_reward: '친구 추천', achievement_reward: '배지·트로피', purchase_discount: '이용권 할인',
  reversal: '지급 취소', expiry: '유효기간 만료', manual_adjustment: '운영 조정',
}
const orderNames: Record<string, string> = {
  pending: '결제 대기', paid: '결제 완료', cancelled: '취소', refunded: '환불 완료', partially_refunded: '일부 환불',
}

export default function CommercePanel() {
  const [passes, setPasses] = useState<PassRow[]>([])
  const [points, setPoints] = useState<PointRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [pointBalance, setPointBalance] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    void (async () => {
      try {
        const { user, error: userError } = await getSignedInUser(supabase)
        if (userError) throw userError
        if (!user) return
        const [passResult, pointResult, orderResult, balanceResult] = await Promise.all([
          supabase.from('commerce_entitlements').select('id,product_code,status,issued_at,expires_at').eq('user_id', user.id).order('issued_at', { ascending: false }).limit(30),
          supabase.from('commerce_point_events').select('id,event_type,points_delta,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
          supabase.from('commerce_orders').select('id,product_title,paid_amount_krw,point_discount_krw,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
          supabase.rpc('my_commerce_point_balance'),
        ])
        if (passResult.error) throw passResult.error
        if (pointResult.error) throw pointResult.error
        if (orderResult.error) throw orderResult.error
        if (balanceResult.error) throw balanceResult.error
        if (cancelled) return
        setPasses((passResult.data ?? []) as PassRow[])
        setPoints((pointResult.data ?? []) as PointRow[])
        setOrders((orderResult.data ?? []) as OrderRow[])
        setPointBalance(Number(balanceResult.data ?? 0))
      } catch {
        if (!cancelled) setError('이용 내역을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Awards and purchases are disabled until the merchant, prices, PG, and reward policy are finalized.
  // There is no client-side grant, spend, or purchase action in this panel.
  return <section style={card} aria-labelledby="commerce-title">
    <h2 id="commerce-title" style={{ margin: '0 0 6px', fontSize: 16 }}>🎟️ 이용권 · 포인트</h2>
    <p style={{ margin: '0 0 12px', color: palette.slate600, fontSize: 12, lineHeight: 1.5 }}>회당 이용권과 친구 추천·트로피 포인트를 준비 중입니다. 가격과 보상 기준이 확정되기 전에는 결제하거나 포인트를 받을 수 없습니다.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,130px),1fr))', gap: 7 }}>
      {[['포인트', loading || error ? '—' : `${pointBalance.toLocaleString()}P`], ['사용 가능한 이용권', loading || error ? '—' : `${passes.filter((pass) => pass.status === 'available').length}장`], ['결제', '준비 중']].map(([label, value]) =>
        <div key={label} style={{ padding: '9px 11px', borderRadius: 9, background: palette.green50, color: palette.emerald900 }}><div style={{ fontSize: 11 }}>{label}</div><strong style={{ fontSize: 16 }}>{value}</strong></div>) }
    </div>
    <p style={{ margin: '10px 0 0', color: palette.slate500, fontSize: 11, lineHeight: 1.5 }}>예정 방식: 9·12·18홀 이용권을 라운드 한 번에 사용하고, 같은 라운드를 수정·재개할 때는 다시 차감하지 않습니다. 월 구독은 별도 상품으로 검토합니다.</p>
    {loading && <p role="status" style={{ fontSize: 11, color: palette.slate500 }}>이용 내역을 불러오는 중…</p>}
    {error && <p role="alert" style={{ fontSize: 11, color: palette.red700 }}>{error}</p>}
    {!loading && !error && (passes.length > 0 || points.length > 0 || orders.length > 0) && <details style={{ marginTop: 12, fontSize: 11 }}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>이용 내역 보기</summary>
      {passes.length > 0 && <div><h3 style={{ fontSize: 12 }}>이용권</h3>{passes.map((pass) => <p key={pass.id}>{names[pass.product_code] ?? pass.product_code} · {pass.status === 'available' ? '사용 가능' : pass.status === 'used' ? '사용 완료' : '취소'} · {new Date(pass.issued_at).toLocaleDateString('ko-KR')}</p>)}</div>}
      {points.length > 0 && <div><h3 style={{ fontSize: 12 }}>포인트</h3>{points.map((point) => <p key={point.id}>{pointNames[point.event_type] ?? point.event_type} · {point.points_delta > 0 ? '+' : ''}{point.points_delta.toLocaleString()}P · {new Date(point.created_at).toLocaleDateString('ko-KR')}</p>)}</div>}
      {orders.length > 0 && <div><h3 style={{ fontSize: 12 }}>주문</h3>{orders.map((order) => <p key={order.id}>{order.product_title} · {order.paid_amount_krw.toLocaleString()}원{order.point_discount_krw > 0 ? ` (포인트 할인 ${order.point_discount_krw.toLocaleString()}원)` : ''} · {orderNames[order.status] ?? order.status} · {new Date(order.created_at).toLocaleDateString('ko-KR')}</p>)}</div>}
    </details>}
  </section>
}
