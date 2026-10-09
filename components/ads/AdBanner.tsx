'use client'

import React, { useEffect } from 'react'

interface AdBannerProps {
  type?: 'adsense' | 'direct'
  // 애드센스 설정값
  adClient?: string
  adSlot?: string
  // 직접 광고 설정값
  bannerImageUrl?: string
  title?: string
  subtitle?: string
  linkUrl?: string
  badgeText?: string
}

declare global {
  interface Window {
    adsbygoogle?: any[]
  }
}

export default function AdBanner({
  type = 'direct',
  adClient = 'ca-pub-XXXXXXXXXXXXXXXX',
  adSlot = '1234567890',
  bannerImageUrl,
  title = '골프존 파크 10,000원 즉시 할인 쿠폰팩',
  subtitle = '신규 가입자 전원 100% 무료 증정 이벤트 바로가기 >',
  linkUrl = '#',
  badgeText = 'AD'
}: AdBannerProps) {

  // 구글 애드센스 스크립트 실행
  useEffect(() => {
    if (type === 'adsense') {
      try {
        if (typeof window !== 'undefined') {
          (window.adsbygoogle = window.adsbygoogle || []).push({})
        }
      } catch (err) {
        console.error('AdSense error:', err)
      }
    }
  }, [type])

  return (
    <div className="w-full bg-white border-t border-slate-200 shadow-sm transition-all">
      {type === 'adsense' ? (
        // [1] 구글 애드센스 배너
        <div className="py-2 text-center bg-slate-100 min-h-[60px] flex items-center justify-center">
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', maxHeight: '70px' }}
            data-ad-client={adClient}
            data-ad-slot={adSlot}
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />
        </div>
      ) : (
        // [2] 자체 스폰서 / 제휴 직접 광고 배너
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-emerald-900 to-slate-900 text-white hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="text-[10px] bg-amber-400 text-slate-900 font-extrabold px-1.5 py-0.5 rounded tracking-wider shrink-0">
              {badgeText}
            </span>
            <div className="truncate">
              <p className="text-xs font-bold text-emerald-300 truncate">{title}</p>
              <p className="text-[11px] text-slate-300 truncate">{subtitle}</p>
            </div>
          </div>
          <span className="text-xs text-amber-300 font-semibold shrink-0 ml-2">보러가기 ➔</span>
        </a>
      )}
    </div>
  )
}