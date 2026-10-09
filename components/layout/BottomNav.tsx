'use client'

import React from 'react'

export type TabType = 'home' | 'join' | 'video' | 'lesson' | 'shop' | 'score'

interface BottomNavProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'home', label: '홈', icon: '🏠' },
    { id: 'join', label: '조인·번개', icon: '🤝' },
    { id: 'video', label: '영상', icon: '📺' },
    { id: 'lesson', label: '레슨', icon: '👨‍🏫' },
    { id: 'shop', label: '공구', icon: '🔥' },
    { id: 'score', label: '스코어', icon: '⛳' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 flex items-center justify-around h-16 shadow-lg">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as TabType)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
              isActive ? 'text-emerald-700 font-bold scale-105' : 'text-slate-400 font-medium hover:text-slate-600'
            }`}
          >
            <span className="text-lg mb-0.5">{tab.icon}</span>
            <span className="text-[10px] tracking-tight">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}