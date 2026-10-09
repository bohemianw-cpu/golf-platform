'use client'

import React from 'react'

interface HomeTabProps {
  onNavigate: (tab: 'home' | 'video' | 'lesson' | 'shop' | 'score') => void
  user: any
  onOpenAuth: () => void
}

export default function HomeTab({ onNavigate, user, onOpenAuth }: HomeTabProps) {
  return (
    <div className="space-y-5 pb-6">
      {/* 상단 웰컴 배너 */}
      <div className="bg-gradient-to-br from-emerald-800 to-teal-900 text-white rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs bg-emerald-600/80 px-2 py-0.5 rounded font-medium">GOLF PLATFORM</span>
            <h2 className="text-xl font-bold mt-1.5">
  {user ? `${user.nickname || user.email?.split('@')[0]}님 환영합니다! ⛳` : '더 즐거운 스마트 골프 라이프 🏌️'}
</h2>
            <p className="text-xs text-emerald-200 mt-1">스윙 교정부터 필드 스코어 기록, 골프 장비 공구까지</p>
          </div>
          {!user && (
            <button
              onClick={onOpenAuth}
              className="bg-amber-400 hover:bg-amber-500 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg shadow"
            >
              로그인
            </button>
          )}
        </div>

        {/* 퀵 바로가기 버튼 */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-emerald-700/60">
          <button
            onClick={() => onNavigate('score')}
            className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl text-left flex items-center justify-between transition-all"
          >
            <div>
              <p className="text-[11px] text-emerald-300">필드 라운딩 중인가요?</p>
              <p className="text-xs font-bold text-white">⛳ 실시간 스코어 기록</p>
            </div>
            <span className="text-lg">➔</span>
          </button>
          <button
            onClick={() => onNavigate('lesson')}
            className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl text-left flex items-center justify-between transition-all"
          >
            <div>
              <p className="text-[11px] text-emerald-300">스윙 고민 해결</p>
              <p className="text-xs font-bold text-white">📹 프로 영상 문의</p>
            </div>
            <span className="text-lg">➔</span>
          </button>
        </div>
      </div>

      {/* 마감 임박 공동구매 하이라이트 */}
      <section className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🔥</span>
            <h3 className="font-bold text-slate-900 text-sm">마감 임박 골프용품 공동구매</h3>
          </div>
          <button onClick={() => onNavigate('shop')} className="text-xs text-emerald-700 font-semibold">
            전체보기 ➔
          </button>
        </div>
        <div
          onClick={() => onNavigate('shop')}
          className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-3 cursor-pointer hover:border-emerald-500 transition-all"
        >
          <div className="w-20 h-20 bg-slate-200 rounded-lg flex items-center justify-center text-3xl shrink-0">
            ⚪
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded">마감 D-1</span>
              <p className="text-xs font-bold text-slate-800 mt-1">[특가] 타이틀리스트 Pro V1 1더즌 (12구)</p>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <div>
                <span className="text-xs line-through text-slate-400 mr-1.5">65,000원</span>
                <span className="text-sm font-extrabold text-red-600">43,000원</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">184명 참여 중</span>
            </div>
          </div>
        </div>
      </section>

      {/* 인기 레슨 영상 피드 하이라이트 */}
      <section className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">📺</span>
            <h3 className="font-bold text-slate-900 text-sm">오늘의 스윙 솔루션 영상</h3>
          </div>
          <button onClick={() => onNavigate('video')} className="text-xs text-emerald-700 font-semibold">
            영상 더보기 ➔
          </button>
        </div>
        <div
          onClick={() => onNavigate('video')}
          className="border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all"
        >
          <div className="h-36 bg-slate-800 flex items-center justify-center text-white relative">
            <span className="text-4xl opacity-80">▶️</span>
            <span className="absolute bottom-2 right-2 bg-black/70 text-[10px] text-white px-2 py-0.5 rounded">
              08:42
            </span>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded">
                드라이버 교정
              </span>
              <span className="text-[11px] text-slate-500 font-medium">김민준 프로 (KPGA 투어프로)</span>
            </div>
            <p className="text-xs font-bold text-slate-900">
              우측으로 휘는 슬라이스 10분만에 잡는 헤드 궤도 공식
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}