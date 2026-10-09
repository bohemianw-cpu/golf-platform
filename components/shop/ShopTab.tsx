'use client'

import React, { useState, useEffect } from 'react'

interface GroupBuyItem {
  id: string
  name: string
  originalPrice: number
  salePrice: number
  participants: number
  targetCount: number
  timeLeftSeconds: number
  icon: string
}

export default function ShopTab() {
  const [items, setItems] = useState<GroupBuyItem[]>([
    {
      id: 'g1',
      name: '타이틀리스트 Pro V1 골프공 (12구/1더즌)',
      originalPrice: 65000,
      salePrice: 43000,
      participants: 184,
      targetCount: 200,
      timeLeftSeconds: 84600,
      icon: '⚪'
    },
    {
      id: 'g2',
      name: '부쉬넬 거리측정기 Pro X3 Plus (한정수량)',
      originalPrice: 690000,
      salePrice: 489000,
      participants: 48,
      targetCount: 50,
      timeLeftSeconds: 43200,
      icon: '🔭'
    },
    {
      id: 'g3',
      name: '천연 양피 골프장갑 3매 세트 (좌수용)',
      originalPrice: 45000,
      salePrice: 24900,
      participants: 312,
      targetCount: 300,
      timeLeftSeconds: 61200,
      icon: '🧤'
    }
  ])

  // 타이머 1초마다 감소
  useEffect(() => {
    const timer = setInterval(() => {
      setItems(prev =>
        prev.map(item => ({
          ...item,
          timeLeftSeconds: Math.max(0, item.timeLeftSeconds - 1)
        }))
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleJoinGroupBuy = (item: GroupBuyItem) => {
    alert(`[${item.name}] 공동구매 참여가 완료되었습니다! 공구 성공 시 결제 안내 메시지가 발송됩니다.`)
  }

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">골프용품 공동구매 특가</h2>
        <p className="text-xs text-slate-500">인원이 모일수록 가격이 내려갑니다. 마감 전 참여해보세요!</p>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const discountPercent = Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100)
          const progressPercent = Math.min(100, Math.round((item.participants / item.targetCount) * 100))

          return (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-4 space-y-3">
              <div className="flex gap-3">
                <div className="w-20 h-20 bg-slate-100 rounded-xl flex items-center justify-center text-4xl shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded">
                      남은시간 {formatTimer(item.timeLeftSeconds)}
                    </span>
                    <span className="text-xs font-black text-red-600">{discountPercent}% OFF</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-xs mt-1 leading-snug">{item.name}</h3>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xs line-through text-slate-400">
                      {item.originalPrice.toLocaleString()}원
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {item.salePrice.toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 달성률 게이지 바 */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                  <span>현재 {item.participants}명 참여</span>
                  <span className="text-emerald-700">{progressPercent}% 달성</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <button
                onClick={() => handleJoinGroupBuy(item)}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-2.5 rounded-xl shadow transition-colors"
              >
                공동구매 신청하기 ➔
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}