'use client'

import React, { useState } from 'react'

interface Pro {
  id: string
  name: string
  title: string
  region: string
  specialty: string
  price: string
  rating: number
  location: string
}

export default function LessonTab() {
  const [selectedRegion, setSelectedRegion] = useState('전체')
  const [modalPro, setModalPro] = useState<Pro | null>(null)
  const [swingProblem, setSwingProblem] = useState('슬라이스')
  const [videoFile, setVideoFile] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)

  const pros: Pro[] = [
    {
      id: 'p1',
      name: '김민준 프로',
      title: 'KPGA 투어프로 / 11년 경력',
      region: '서울/경기',
      specialty: '드라이버 비거리 & 슬라이스 교정',
      price: '회당 90,000원',
      rating: 4.9,
      location: '서울 강남구 역삼 골프랩'
    },
    {
      id: 'p2',
      name: '이수연 프로',
      title: 'KLPGA 정회원 / 8년 경력',
      region: '부산/경남',
      specialty: '초보자 입문 & 아이언 정확도',
      price: '회당 80,000원',
      rating: 4.8,
      location: '부산 해운대 센텀골프스튜디오'
    },
    {
      id: 'p3',
      name: '박준혁 프로',
      title: 'KPGA 프로 / 14년 경력',
      region: '대구/경북',
      specialty: '숏게임 & 퍼팅 원포인트',
      price: '회당 100,000원',
      rating: 5.0,
      location: '대구 수성구 파크골프아카데미'
    },
  ]

  const regions = ['전체', '서울/경기', '부산/경남', '대구/경북']

  const filteredPros = selectedRegion === '전체'
    ? pros
    : pros.filter(p => p.region === selectedRegion)

  const handleSendInquiry = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setModalPro(null)
      alert('스윙 영상 분석 문의가 프로님께 정상 접수되었습니다! 답변이 오면 알림을 드립니다.')
    }, 1200)
  }

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">레슨 프로 찾기</h2>
        <p className="text-xs text-slate-500">내 지역 맞춤 레슨과 온라인 스윙 영상 분석을 받아보세요.</p>
      </div>

      {/* 지역 필터 */}
      <div className="flex gap-2">
        {regions.map(r => (
          <button
            key={r}
            onClick={() => setSelectedRegion(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedRegion === r
                ? 'bg-emerald-800 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* 프로 리스트 */}
      <div className="space-y-3">
        {filteredPros.map((pro) => (
          <div key={pro.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{pro.name}</h3>
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                    ★ {pro.rating}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{pro.title}</p>
                <p className="text-xs font-semibold text-emerald-700 mt-1">🎯 주분야: {pro.specialty}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">📍 {pro.location}</p>
              </div>
              <span className="text-xs font-extrabold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                {pro.price}
              </span>
            </div>

            {/* 버튼 2개: 일반 문의 & 내 스윙 영상으로 분석 문의 */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setModalPro(pro)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs py-2 rounded-lg transition-colors border border-emerald-200 flex items-center justify-center gap-1"
              >
                <span>💬</span> 레슨 문의
              </button>
              <button
                onClick={() => setModalPro(pro)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-2 rounded-lg transition-colors shadow flex items-center justify-center gap-1"
              >
                <span>📹</span> 스윙 영상 문의
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 스윙 영상 문의 모달 */}
      {modalPro && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 text-sm">{modalPro.name} 프로에게 영상 문의</h3>
              <button onClick={() => setModalPro(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <form onSubmit={handleSendInquiry} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">가장 고민되는 문제점</label>
                <select
                  value={swingProblem}
                  onChange={(e) => setSwingProblem(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                >
                  <option value="슬라이스">슬라이스 (우측 휨)</option>
                  <option value="훅">훅 (좌측 휨)</option>
                  <option value="뒤땅/탑핑">뒤땅 / 탑핑</option>
                  <option value="비거리 부족">비거리 부족</option>
                  <option value="숏게임/퍼팅">숏게임 / 퍼팅 고민</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">스윙 영상 업로드 (mp4/mov)</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.value)}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">문의 내용 / 현재 스코어</label>
                <textarea
                  rows={3}
                  placeholder="예: 드라이버 평균 200m 치는데 후반 홀에서 슬라이스가 심합니다."
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs resize-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalPro(null)}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold text-xs py-2 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitted}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-2 rounded-lg shadow"
                >
                  {submitted ? '전송 중...' : '문의 보내기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}