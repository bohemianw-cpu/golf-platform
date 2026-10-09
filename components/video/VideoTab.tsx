'use client'

import React, { useState } from 'react'

interface VideoItem {
  id: string
  title: string
  proName: string
  proTitle: string
  category: string
  duration: string
  thumbnailIcon: string
  views: string
}

interface VideoTabProps {
  onSelectProForLesson: (proName: string) => void
}

export default function VideoTab({ onSelectProForLesson }: VideoTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('전체')

  const categories = ['전체', '드라이버', '아이언', '어프로치', '퍼팅', '멘탈·상식']

  const videos: VideoItem[] = [
    {
      id: 'v1',
      title: '우측 슬라이스 완전 정복: 백스윙 탑 앵글 교정법',
      proName: '김민준 프로',
      proTitle: 'KPGA 투어프로 / 경력 11년',
      category: '드라이버',
      duration: '07:20',
      thumbnailIcon: '🏌️‍♂️',
      views: '1.4만회'
    },
    {
      id: 'v2',
      title: '아이언 뒤땅/탑핑 없애는 핸드퍼스트와 체중이동 비밀',
      proName: '이수연 프로',
      proTitle: 'KLPGA 정회원 / 레슨 8년',
      category: '아이언',
      duration: '11:05',
      thumbnailIcon: '⛳',
      views: '2.1만회'
    },
    {
      id: 'v3',
      title: '3퍼트 절대 안 하는 거리감 맞추기 3원칙',
      proName: '박준혁 프로',
      proTitle: 'KPGA 프로 / 숏게임 마스터',
      category: '퍼팅',
      duration: '06:14',
      thumbnailIcon: '🎯',
      views: '8.9천회'
    },
  ]

  const filteredVideos = selectedCategory === '전체'
    ? videos
    : videos.filter(v => v.category === selectedCategory)

  return (
    <div className="space-y-4 pb-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-base font-bold text-slate-900">골프 영상 & 레슨 피드</h2>
        <p className="text-xs text-slate-500">영상을 보고 마음에 드는 프로에게 바로 문의해보세요.</p>
      </div>

      {/* 카테고리 필터 태그 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
              selectedCategory === cat
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 비디오 리스트 */}
      <div className="space-y-4">
        {filteredVideos.map((video) => (
          <div key={video.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {/* 영상 썸네일 영역 */}
            <div className="h-44 bg-slate-900 flex items-center justify-center relative cursor-pointer group">
              <span className="text-5xl group-hover:scale-110 transition-transform">{video.thumbnailIcon}</span>
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <span className="bg-emerald-600 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-lg pl-0.5">
                  ▶
                </span>
              </div>
              <span className="absolute bottom-2 right-2 bg-black/80 text-[10px] text-white px-2 py-0.5 rounded font-mono">
                {video.duration}
              </span>
            </div>

            {/* 영상 설명 & 프로 연결 영역 */}
            <div className="p-3.5 space-y-2.5">
              <div>
                <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded mr-1.5">
                  {video.category}
                </span>
                <span className="text-[11px] text-slate-400">조회수 {video.views}</span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{video.title}</h3>
              </div>

              {/* 프로 프로필 바 + 원클릭 레슨 문의 버튼 */}
              <div className="bg-emerald-50/70 border border-emerald-100 p-2.5 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-950">{video.proName}</p>
                  <p className="text-[10px] text-emerald-700">{video.proTitle}</p>
                </div>
                <button
                  onClick={() => onSelectProForLesson(video.proName)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow transition-colors shrink-0"
                >
                  프로에게 레슨 문의 ➔
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}