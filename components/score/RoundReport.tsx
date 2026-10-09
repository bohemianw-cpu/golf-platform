'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { HoleRecord, ClubItem } from '@/types/golf'

export interface SavedRoundData {
  id: string
  date: string
  ccName?: string // 골프장(CC) 명칭 (동일 CC 비교 매칭용)
  courseSubName?: string // 코스명 (Out/In, 코스 구분)
  totalScore: number
  totalPar: number
  scoreDiff: number
  girPercent: number
  fwPercent: number
  totalPutts: number
  holes: HoleRecord[]
}

export interface FriendUser {
  id: string
  name: string
  avatar?: string
  handicap?: number
}

export interface FriendRoundData extends SavedRoundData {
  userId: string
  userName: string
}

interface RoundReportProps {
  // ScoreTab (실시간 라운드 완료)
  completedHoles?: HoleRecord[]
  holePars?: number[]
  clubs?: ClubItem[]
  onBackToScore?: () => void
  onStartNewRound?: () => void

  // MyTab (과거 히스토리 열람)
  savedRound?: SavedRoundData | null
  isHistoryView?: boolean
  onClose?: () => void

  // 🌟 [확장] 동일 CC 비교 대상 데이터 Props
  currentCcName?: string // 현재 라운드의 CC 명 (미지정 시 savedRound?.ccName 또는 기본값)
  myPastRounds?: SavedRoundData[] // 내 과거 라운드 전체 목록
  friendsRounds?: FriendRoundData[] // 친구들의 라운드 목록
  friendsList?: FriendUser[] // 친구 목록
}

type AnalysisTab = 'score' | 'driver' | 'club' | 'gir' | 'shortgame' | 'putting'

// 비교 모드: 동급 골퍼 평균(기본), 나의 이전 기록, 친구의 기록
type CompareMode = 'benchmark' | 'my' | 'friend'
type PresetQuickFilter = 'recent' | 'best' | 'course_avg' | 'custom'

interface BenchmarkStats {
  score: number
  par3: number
  par4: number
  par5: number
  birdieRate: number
  parRate: number
  bogeyRate: number
  doubleRate: number
  penaltyRate: number
  driverMax: number
  driverAvg: number
  fwRate: number
  girRate: number
  fwGirRate: number
  roughGirRate: number
  bunkerGirRate: number
  approachRate: number
  scrambleRate: number
  bunkerSaveRate: number
  avgPutts: number
  girPutts: number
  totalPutts: number
  onePutt: number
  twoPutt: number
  threePutt: number
}

// 기본 클럽 표준 접근율 (%)
const DEFAULT_CLUB_APPROACH: Record<string, number> = {
  '드라이버': 68,
  '3번 우드': 70,
  '4번 유틸': 72,
  '5번 아이언': 73,
  '6번 아이언': 75,
  '7번 아이언': 77,
  '8번 아이언': 79,
  '9번 아이언': 81,
  'PW': 83,
  '52도 웨지': 85,
  '56도 웨지': 86,
  '퍼터': 88,
}

// 기본 클럽 표준 비거리 (m)
const DEFAULT_CLUB_DISTANCES: Record<string, number> = {
  '드라이버': 210,
  '3번 우드': 190,
  '4번 유틸': 180,
  '5번 아이언': 160,
  '6번 아이언': 150,
  '7번 아이언': 140,
  '8번 아이언': 130,
  '9번 아이언': 120,
  'PW': 110,
  '52도 웨지': 90,
  '56도 웨지': 70,
  '퍼터': 10,
}

const DEFAULT_REPORT_CLUBS: ClubItem[] = [
  { id: '1', name: '드라이버', category: 'driver' },
  { id: '2', name: '3번 우드', category: 'wood' },
  { id: '3', name: '4번 유틸', category: 'utility' },
  { id: '4', name: '5번 아이언', category: 'iron' },
  { id: '5', name: '6번 아이언', category: 'iron' },
  { id: '6', name: '7번 아이언', category: 'iron' },
  { id: '7', name: '8번 아이언', category: 'iron' },
  { id: '8', name: '9번 아이언', category: 'iron' },
  { id: '9', name: 'PW', category: 'wedge' },
  { id: '10', name: '52도 웨지', category: 'wedge' },
  { id: '11', name: '56도 웨지', category: 'wedge' },
  { id: '12', name: '퍼터', category: 'putter' },
]

// 동급 실력그룹 벤치마크 기본값
const DEFAULT_BENCHMARK: BenchmarkStats = {
  score: 84.5,
  par3: 3.45,
  par4: 4.65,
  par5: 5.55,
  birdieRate: 8.5,
  parRate: 45.0,
  bogeyRate: 32.0,
  doubleRate: 12.0,
  penaltyRate: 3.5,
  driverMax: 228,
  driverAvg: 198,
  fwRate: 51.5,
  girRate: 34.0,
  fwGirRate: 46.5,
  roughGirRate: 26.0,
  bunkerGirRate: 14.5,
  approachRate: 78.0,
  scrambleRate: 36.0,
  bunkerSaveRate: 22.0,
  avgPutts: 1.95,
  girPutts: 2.05,
  totalPutts: 35.1,
  onePutt: 3.8,
  twoPutt: 11.2,
  threePutt: 3.0,
}

// ----------------------------------------------------
// [보조 유틸] 단일/다수 라운드 데이터로부터 벤치마크 통계 객체 산출
// ----------------------------------------------------
function calculateStatsFromRounds(rounds: SavedRoundData[]): BenchmarkStats {
  if (!rounds || rounds.length === 0) return DEFAULT_BENCHMARK

  const roundCount = rounds.length
  let totalScoreSum = 0
  let totalPuttsSum = 0
  let totalFwRateSum = 0
  let totalGirRateSum = 0
  let totalDriverMax = 0
  let totalDriverAvgSum = 0
  let driverAvgCount = 0

  const par3Scores: number[] = []
  const par4Scores: number[] = []
  const par5Scores: number[] = []
  let allHolesCount = 0
  let birdieCount = 0
  let parCount = 0
  let bogeyCount = 0
  let doubleCount = 0
  let penalties = 0
  let onePutts = 0
  let twoPutts = 0
  let threePutts = 0
  let girPuttsSum = 0
  let girHolesCount = 0
  let scrambleSuccess = 0
  let nonGirCount = 0
  let bunkerSuccess = 0
  let bunkerHolesCount = 0

  rounds.forEach((rnd) => {
    totalScoreSum += rnd.totalScore
    totalPuttsSum += rnd.totalPutts
    totalFwRateSum += rnd.fwPercent
    totalGirRateSum += rnd.girPercent

    const hList = rnd.holes || []
    allHolesCount += hList.length

    hList.forEach((h) => {
      if (h.par === 3) par3Scores.push(h.score)
      if (h.par === 4) par4Scores.push(h.score)
      if (h.par === 5) par5Scores.push(h.score)

      if (h.scoreDiff <= -1) birdieCount++
      else if (h.scoreDiff === 0) parCount++
      else if (h.scoreDiff === 1) bogeyCount++
      else if (h.scoreDiff >= 2) doubleCount++

      if (h.putts === 1) onePutts++
      else if (h.putts === 2) twoPutts++
      else if (h.putts >= 3) threePutts++

      if (h.gir) {
        girHolesCount++
        girPuttsSum += (h.putts || 0)
      } else {
        nonGirCount++
        if (h.scoreDiff <= 0) scrambleSuccess++
      }

      const shots = h.shots || []
      const holePenalties = shots.reduce((sum, s) => sum + (s.penalty || 0), 0)
      penalties += holePenalties

      if (shots.some((s) => s.ballLie === '벙커')) {
        bunkerHolesCount++
        if (h.scoreDiff <= 0) bunkerSuccess++
      }

      const driverShot = shots.find((s) => s.club === '드라이버' && s.shotNumber === 1 && (s.shotDistance || 0) > 0)
      if (driverShot) {
        if (driverShot.shotDistance > totalDriverMax) totalDriverMax = driverShot.shotDistance
        totalDriverAvgSum += driverShot.shotDistance
        driverAvgCount++
      }
    })
  })

  const avgScore = Number((totalScoreSum / roundCount).toFixed(1))
  const avgPar3 = par3Scores.length > 0 ? Number((par3Scores.reduce((a, b) => a + b, 0) / par3Scores.length).toFixed(2)) : 3.4
  const avgPar4 = par4Scores.length > 0 ? Number((par4Scores.reduce((a, b) => a + b, 0) / par4Scores.length).toFixed(2)) : 4.6
  const avgPar5 = par5Scores.length > 0 ? Number((par5Scores.reduce((a, b) => a + b, 0) / par5Scores.length).toFixed(2)) : 5.5

  const hTot = allHolesCount || 1
  const avgPuttsHole = Number((totalPuttsSum / hTot).toFixed(2))
  const avgGirPutts = girHolesCount > 0 ? Number((girPuttsSum / girHolesCount).toFixed(2)) : 2.0

  return {
    score: avgScore,
    par3: avgPar3,
    par4: avgPar4,
    par5: avgPar5,
    birdieRate: Number(((birdieCount / hTot) * 100).toFixed(1)),
    parRate: Number(((parCount / hTot) * 100).toFixed(1)),
    bogeyRate: Number(((bogeyCount / hTot) * 100).toFixed(1)),
    doubleRate: Number(((doubleCount / hTot) * 100).toFixed(1)),
    penaltyRate: Number(((penalties / hTot) * 10).toFixed(1)),
    driverMax: totalDriverMax > 0 ? totalDriverMax : 225,
    driverAvg: driverAvgCount > 0 ? Math.round(totalDriverAvgSum / driverAvgCount) : 195,
    fwRate: Math.round(totalFwRateSum / roundCount),
    girRate: Math.round(totalGirRateSum / roundCount),
    fwGirRate: 46.5,
    roughGirRate: 26.0,
    bunkerGirRate: 14.5,
    approachRate: 77.0,
    scrambleRate: nonGirCount > 0 ? Math.round((scrambleSuccess / nonGirCount) * 100) : 38,
    bunkerSaveRate: bunkerHolesCount > 0 ? Math.round((bunkerSuccess / bunkerHolesCount) * 100) : 22,
    avgPutts: avgPuttsHole,
    girPutts: avgGirPutts,
    totalPutts: Number((totalPuttsSum / roundCount).toFixed(1)),
    onePutt: Number(((onePutts / roundCount)).toFixed(1)),
    twoPutt: Number(((twoPutts / roundCount)).toFixed(1)),
    threePutt: Number(((threePutts / roundCount)).toFixed(1)),
  }
}

// ----------------------------------------------------
// 메인 컴포넌트
// ----------------------------------------------------
export default function RoundReport({
  completedHoles: propHoles,
  holePars: propPars,
  clubs: propClubs = [],
  savedRound,
  isHistoryView = false,
  onBackToScore,
  onStartNewRound,
  onClose,
  currentCcName,
  myPastRounds: propMyRounds,
  friendsRounds: propFriendsRounds,
  friendsList: propFriendsList,
}: RoundReportProps) {
  const [currentUser, setCurrentUser] = useState<string>('골퍼')
  const [activeTab, setActiveTab] = useState<AnalysisTab>('score')

  // CC 명칭 확정 (Props -> savedRound -> 기본값)
  const effectiveCcName = currentCcName || savedRound?.ccName || '스카이밸리 CC'

  // ==========================================
  // [비교 대상 설정 상태]
  // ==========================================
  // 기본값: 'benchmark' (동급 골퍼들 평균값과의 비교)
  const [compareMode, setCompareMode] = useState<CompareMode>('benchmark')
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<PresetQuickFilter>('recent')
  const [selectedFriendId, setSelectedFriendId] = useState<string>('')
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  // 모달 내 필터 및 정렬
  const [modalSortOrder, setModalSortOrder] = useState<'latest' | 'lowestScore' | 'highestScore'>('latest')
  const [modalSearchText, setModalSearchText] = useState<string>('')

  // 클럽별 분석 서브 필터
  const [clubMetricMode, setClubMetricMode] = useState<'both' | 'distance' | 'approach'>('both')
  const [clubCategoryFilter, setClubCategoryFilter] = useState<'all' | 'wood' | 'iron' | 'wedge'>('all')

  // 데이터 소스 정규화
  const holes = savedRound?.holes || propHoles || []
  const holePars = propPars && propPars.length > 0
    ? propPars
    : holes.length > 0 ? holes.map((h) => h.par || 4) : [4,4,3,4,5,4,4,3,5, 4,4,3,5,4,4,3,4,5]

  const roundDate = savedRound?.date || new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const totalPar = savedRound?.totalPar || holePars.slice(0, holes.length || 18).reduce((a, b) => a + b, 0) || 72
  const totalScore = savedRound?.totalScore !== undefined ? savedRound.totalScore : holes.reduce((acc, h) => acc + h.score, 0)
  const totalDiff = savedRound?.scoreDiff !== undefined ? savedRound.scoreDiff : totalScore - totalPar

  // ==========================================
  // [동일 CC 과거 라운드 & 친구 라운드 데이터 구성]
  // ==========================================
  // 1) 내 과거 라운드 (props 또는 localStorage 기반, 동일 CC 필터링)
  const myMatchingRounds = useMemo<SavedRoundData[]>(() => {
    let source: SavedRoundData[] = []
    if (propMyRounds && propMyRounds.length > 0) {
      source = propMyRounds
    } else if (typeof window !== 'undefined') {
      const u = localStorage.getItem('golf_user') || 'guest'
      const raw = localStorage.getItem(`golf_rounds_${u}`)
      if (raw) {
        try { source = JSON.parse(raw) } catch (_) {}
      }
    }

    if (source.length === 0) {
      source = [
        {
          id: 'my_rnd_prev_1',
          date: '2024.08.18',
          ccName: effectiveCcName,
          totalScore: 82,
          totalPar: 72,
          scoreDiff: 10,
          girPercent: 38,
          fwPercent: 57,
          totalPutts: 33,
          holes: holes.length > 0 ? holes : [],
        },
        {
          id: 'my_rnd_prev_2',
          date: '2024.06.05',
          ccName: effectiveCcName,
          totalScore: 79, // 코스 라베
          totalPar: 72,
          scoreDiff: 7,
          girPercent: 44,
          fwPercent: 64,
          totalPutts: 31,
          holes: holes.length > 0 ? holes : [],
        },
        {
          id: 'my_rnd_prev_3',
          date: '2024.04.22',
          ccName: effectiveCcName,
          totalScore: 88,
          totalPar: 72,
          scoreDiff: 16,
          girPercent: 27,
          fwPercent: 42,
          totalPutts: 37,
          holes: holes.length > 0 ? holes : [],
        },
      ]
    }

    return source.filter((r) => {
      const isNotCurrent = r.id !== savedRound?.id
      const matchesCc = !r.ccName || r.ccName === effectiveCcName
      return isNotCurrent && matchesCc
    })
  }, [propMyRounds, savedRound?.id, effectiveCcName, holes])

  // 2) 친구 라운드 데이터
  const friendsMatchingRounds = useMemo<FriendRoundData[]>(() => {
    let source: FriendRoundData[] = []
    if (propFriendsRounds && propFriendsRounds.length > 0) {
      source = propFriendsRounds
    } else {
      source = [
        {
          id: 'fr_rnd_1',
          userId: 'user_kim',
          userName: '김민수',
          date: '2024.09.12',
          ccName: effectiveCcName,
          totalScore: 80,
          totalPar: 72,
          scoreDiff: 8,
          girPercent: 44,
          fwPercent: 64,
          totalPutts: 32,
          holes: holes.length > 0 ? holes : [],
        },
        {
          id: 'fr_rnd_2',
          userId: 'user_kim',
          userName: '김민수',
          date: '2024.07.03',
          ccName: effectiveCcName,
          totalScore: 85,
          totalPar: 72,
          scoreDiff: 13,
          girPercent: 33,
          fwPercent: 50,
          totalPutts: 35,
          holes: holes.length > 0 ? holes : [],
        },
        {
          id: 'fr_rnd_3',
          userId: 'user_lee',
          userName: '이지은 Pro',
          date: '2024.09.28',
          ccName: effectiveCcName,
          totalScore: 76,
          totalPar: 72,
          scoreDiff: 4,
          girPercent: 55,
          fwPercent: 71,
          totalPutts: 30,
          holes: holes.length > 0 ? holes : [],
        },
        {
          id: 'fr_rnd_4',
          userId: 'user_park',
          userName: '박준형',
          date: '2024.08.30',
          ccName: effectiveCcName,
          totalScore: 91,
          totalPar: 72,
          scoreDiff: 19,
          girPercent: 22,
          fwPercent: 35,
          totalPutts: 38,
          holes: holes.length > 0 ? holes : [],
        },
      ]
    }

    return source.filter((r) => !r.ccName || r.ccName === effectiveCcName)
  }, [propFriendsRounds, effectiveCcName, holes])

  // 친구 목록 추출
  const availableFriends = useMemo<FriendUser[]>(() => {
    if (propFriendsList && propFriendsList.length > 0) return propFriendsList
    const map = new Map<string, FriendUser>()
    friendsMatchingRounds.forEach((r) => {
      if (!map.has(r.userId)) {
        map.set(r.userId, {
          id: r.userId,
          name: r.userName,
          handicap: r.totalScore - 72,
        })
      }
    })
    return Array.from(map.values())
  }, [propFriendsList, friendsMatchingRounds])

  useEffect(() => {
    if (compareMode === 'friend' && !selectedFriendId && availableFriends.length > 0) {
      setSelectedFriendId(availableFriends[0].id)
    }
  }, [compareMode, selectedFriendId, availableFriends])

  const currentFriendRounds = useMemo<FriendRoundData[]>(() => {
    if (!selectedFriendId) return []
    return friendsMatchingRounds.filter((r) => r.userId === selectedFriendId)
  }, [friendsMatchingRounds, selectedFriendId])

  // ==========================================
  // [현재 활성화된 비교 대상(Benchmark) 계산]
  // ==========================================
  const activeBenchmark = useMemo<{
    stats: BenchmarkStats
    targetLabel: string
    subLabel: string
    badgeColor: string
    isCustom: boolean
  }>(() => {
    // 1) 기본: 동급 골퍼 평균
    if (compareMode === 'benchmark') {
      return {
        stats: DEFAULT_BENCHMARK,
        targetLabel: '동급 골퍼 평균',
        subLabel: `핸디캡 유사 그룹 (평균 ${DEFAULT_BENCHMARK.score}타)`,
        badgeColor: '#64748b',
        isCustom: false,
      }
    }

    // 2) 나의 과거 기록
    if (compareMode === 'my') {
      if (myMatchingRounds.length === 0) {
        return {
          stats: DEFAULT_BENCHMARK,
          targetLabel: '나의 이전 기록 (데이터 없음)',
          subLabel: '동일 CC 기록이 없어 기본 동급 평균을 표시합니다',
          badgeColor: '#64748b',
          isCustom: false,
        }
      }

      if (selectedQuickFilter === 'recent') {
        const sorted = [...myMatchingRounds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        const target = sorted[0]
        return {
          stats: calculateStatsFromRounds([target]),
          targetLabel: `내 직전 라운드 (${target.date})`,
          subLabel: `${target.totalScore}타 (${target.scoreDiff >= 0 ? `+${target.scoreDiff}` : target.scoreDiff})`,
          badgeColor: '#7c3aed',
          isCustom: true,
        }
      }

      if (selectedQuickFilter === 'best') {
        const sorted = [...myMatchingRounds].sort((a, b) => a.totalScore - b.totalScore)
        const target = sorted[0]
        return {
          stats: calculateStatsFromRounds([target]),
          targetLabel: `내 코스 베스트 [라베] (${target.date})`,
          subLabel: `${target.totalScore}타 (${target.scoreDiff >= 0 ? `+${target.scoreDiff}` : target.scoreDiff})`,
          badgeColor: '#7c3aed',
          isCustom: true,
        }
      }

      if (selectedQuickFilter === 'course_avg') {
        const stats = calculateStatsFromRounds(myMatchingRounds)
        return {
          stats,
          targetLabel: `내 이 코스 평균 (${myMatchingRounds.length}회 누적)`,
          subLabel: `평균 ${stats.score}타 · 퍼팅 ${stats.totalPutts}개`,
          badgeColor: '#7c3aed',
          isCustom: true,
        }
      }

      if (selectedQuickFilter === 'custom' && selectedRoundId) {
        const target = myMatchingRounds.find((r) => r.id === selectedRoundId)
        if (target) {
          return {
            stats: calculateStatsFromRounds([target]),
            targetLabel: `내 라운드 (${target.date})`,
            subLabel: `${target.totalScore}타 (${target.scoreDiff >= 0 ? `+${target.scoreDiff}` : target.scoreDiff})`,
            badgeColor: '#7c3aed',
            isCustom: true,
          }
        }
      }
    }

    // 3) 친구의 기록
    if (compareMode === 'friend') {
      const friendObj = availableFriends.find((f) => f.id === selectedFriendId)
      const friendName = friendObj ? friendObj.name : '친구'

      if (currentFriendRounds.length === 0) {
        return {
          stats: DEFAULT_BENCHMARK,
          targetLabel: `${friendName}님의 기록 없음`,
          subLabel: '해당 CC 기록이 없어 기본 동급 평균을 표시합니다',
          badgeColor: '#64748b',
          isCustom: false,
        }
      }

      if (selectedQuickFilter === 'recent') {
        const sorted = [...currentFriendRounds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        const target = sorted[0]
        return {
          stats: calculateStatsFromRounds([target]),
          targetLabel: `${friendName}님의 최근 라운드 (${target.date})`,
          subLabel: `${target.totalScore}타 (${target.scoreDiff >= 0 ? `+${target.scoreDiff}` : target.scoreDiff})`,
          badgeColor: '#2563eb',
          isCustom: true,
        }
      }

      if (selectedQuickFilter === 'best') {
        const sorted = [...currentFriendRounds].sort((a, b) => a.totalScore - b.totalScore)
        const target = sorted[0]
        return {
          stats: calculateStatsFromRounds([target]),
          targetLabel: `${friendName}님의 코스 베스트 (${target.date})`,
          subLabel: `${target.totalScore}타 (${target.scoreDiff >= 0 ? `+${target.scoreDiff}` : target.scoreDiff})`,
          badgeColor: '#2563eb',
          isCustom: true,
        }
      }

      if (selectedQuickFilter === 'course_avg') {
        const stats = calculateStatsFromRounds(currentFriendRounds)
        return {
          stats,
          targetLabel: `${friendName}님의 코스 평균 (${currentFriendRounds.length}회 누적)`,
          subLabel: `평균 ${stats.score}타 · 퍼팅 ${stats.totalPutts}개`,
          badgeColor: '#2563eb',
          isCustom: true,
        }
      }

      if (selectedQuickFilter === 'custom' && selectedRoundId) {
        const target = currentFriendRounds.find((r) => r.id === selectedRoundId)
        if (target) {
          return {
            stats: calculateStatsFromRounds([target]),
            targetLabel: `${friendName}님의 라운드 (${target.date})`,
            subLabel: `${target.totalScore}타 (${target.scoreDiff >= 0 ? `+${target.scoreDiff}` : target.scoreDiff})`,
            badgeColor: '#2563eb',
            isCustom: true,
          }
        }
      }
    }

    return {
      stats: DEFAULT_BENCHMARK,
      targetLabel: '동급 골퍼 평균',
      subLabel: `평균 ${DEFAULT_BENCHMARK.score}타`,
      badgeColor: '#64748b',
      isCustom: false,
    }
  }, [
    compareMode,
    selectedQuickFilter,
    selectedRoundId,
    selectedFriendId,
    myMatchingRounds,
    currentFriendRounds,
    availableFriends,
  ])

  const benchmark = activeBenchmark.stats

  // ==========================================
  // [1] 내 클럽별 비거리 & 접근율 계산
  // ==========================================
  const allShotsEver = holes.flatMap((h) => h.shots || []).filter((s) => (s.shotDistance || 0) > 0)

  const clubStatsMap: Record<
    string,
    { totalDist: number; count: number; maxDist: number; minDist: number }
  > = {}

  allShotsEver.forEach((s) => {
    if (!clubStatsMap[s.club]) {
      clubStatsMap[s.club] = {
        totalDist: s.shotDistance,
        count: 1,
        maxDist: s.shotDistance,
        minDist: s.shotDistance,
      }
    } else {
      clubStatsMap[s.club].totalDist += s.shotDistance
      clubStatsMap[s.club].count += 1
      clubStatsMap[s.club].maxDist = Math.max(clubStatsMap[s.club].maxDist, s.shotDistance)
      clubStatsMap[s.club].minDist = Math.min(clubStatsMap[s.club].minDist, s.shotDistance)
    }
  })

  const getClubExpectedDistance = (clubName: string): number => {
    if (clubStatsMap[clubName] && clubStatsMap[clubName].count > 0) {
      return Math.round(clubStatsMap[clubName].totalDist / clubStatsMap[clubName].count)
    }
    return DEFAULT_CLUB_DISTANCES[clubName] || 130
  }

  // 각 클럽별 접근율 계산
  const clubApproachMap: Record<string, { totalRate: number; count: number }> = {}

  allShotsEver.forEach((s) => {
    const expected = getClubExpectedDistance(s.club)
    const isApproachTarget =
      s.distanceToPinBefore > 0 &&
      (s.club === '퍼터'
        ? s.ballLie === '그린' || s.ballLie === '홀아웃' || s.distanceToPinBefore <= 30
        : s.distanceToPinBefore <= expected + 20)

    if (isApproachTarget) {
      if (!clubApproachMap[s.club]) {
        clubApproachMap[s.club] = { totalRate: 0, count: 0 }
      }
      const rate = Math.max(0, (1 - s.distanceToPinAfter / s.distanceToPinBefore) * 100)
      clubApproachMap[s.club].totalRate += rate
      clubApproachMap[s.club].count += 1
    }
  })

  const effectiveClubs = propClubs.length > 0 ? propClubs : DEFAULT_REPORT_CLUBS
  const usedClubs = effectiveClubs.filter((c) => clubStatsMap[c.name])

  const approachRatesList = usedClubs
    .map((c) => {
      const stat = clubApproachMap[c.name]
      return stat && stat.count > 0 ? Math.round(stat.totalRate / stat.count) : null
    })
    .filter((r): r is number => r !== null)

  const overallAvgApproach =
    approachRatesList.length > 0
      ? Math.round(approachRatesList.reduce((a, b) => a + b, 0) / approachRatesList.length)
      : 75

  // ==========================================
  // [비교 대상의 클럽별 통계 데이터 산출]
  // ==========================================
  const targetRoundsForClub = useMemo<SavedRoundData[]>(() => {
    if (compareMode === 'my') {
      if (selectedQuickFilter === 'course_avg') return myMatchingRounds
      if (selectedQuickFilter === 'best') {
        const best = [...myMatchingRounds].sort((a, b) => a.totalScore - b.totalScore)[0]
        return best ? [best] : []
      }
      if (selectedQuickFilter === 'custom' && selectedRoundId) {
        const match = myMatchingRounds.find((r) => r.id === selectedRoundId)
        return match ? [match] : []
      }
      const recent = [...myMatchingRounds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
      return recent ? [recent] : []
    }

    if (compareMode === 'friend') {
      if (selectedQuickFilter === 'course_avg') return currentFriendRounds
      if (selectedQuickFilter === 'best') {
        const best = [...currentFriendRounds].sort((a, b) => a.totalScore - b.totalScore)[0]
        return best ? [best] : []
      }
      if (selectedQuickFilter === 'custom' && selectedRoundId) {
        const match = currentFriendRounds.find((r) => r.id === selectedRoundId)
        return match ? [match] : []
      }
      const recent = [...currentFriendRounds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
      return recent ? [recent] : []
    }

    return []
  }, [compareMode, selectedQuickFilter, selectedRoundId, myMatchingRounds, currentFriendRounds])

  const targetClubStatsMap = useMemo<Record<string, { avgDist: number; count: number; approachRate: number }>>(() => {
    const result: Record<string, { avgDist: number; count: number; approachRate: number }> = {}

    if (targetRoundsForClub.length === 0) {
      effectiveClubs.forEach((c) => {
        result[c.name] = {
          avgDist: DEFAULT_CLUB_DISTANCES[c.name] || 130,
          count: 0,
          approachRate: DEFAULT_CLUB_APPROACH[c.name] || 75,
        }
      })
      return result
    }

    const targetShots = targetRoundsForClub
      .flatMap((r) => r.holes || [])
      .flatMap((h) => h.shots || [])
      .filter((s) => (s.shotDistance || 0) > 0)

    const distAcc: Record<string, { totalDist: number; count: number }> = {}
    targetShots.forEach((s) => {
      if (!distAcc[s.club]) distAcc[s.club] = { totalDist: 0, count: 0 }
      distAcc[s.club].totalDist += s.shotDistance
      distAcc[s.club].count += 1
    })

    const approachAcc: Record<string, { totalRate: number; count: number }> = {}
    targetShots.forEach((s) => {
      const exp = distAcc[s.club]?.count > 0
        ? Math.round(distAcc[s.club].totalDist / distAcc[s.club].count)
        : (DEFAULT_CLUB_DISTANCES[s.club] || 130)

      const isTarget = s.distanceToPinBefore > 0 &&
        (s.club === '퍼터'
          ? s.ballLie === '그린' || s.ballLie === '홀아웃' || s.distanceToPinBefore <= 30
          : s.distanceToPinBefore <= exp + 20)

      if (isTarget) {
        if (!approachAcc[s.club]) approachAcc[s.club] = { totalRate: 0, count: 0 }
        const rate = Math.max(0, (1 - s.distanceToPinAfter / s.distanceToPinBefore) * 100)
        approachAcc[s.club].totalRate += rate
        approachAcc[s.club].count += 1
      }
    })

    effectiveClubs.forEach((c) => {
      const dStat = distAcc[c.name]
      const aStat = approachAcc[c.name]
      const avgDist = dStat && dStat.count > 0 ? Math.round(dStat.totalDist / dStat.count) : (DEFAULT_CLUB_DISTANCES[c.name] || 130)
      const approachRate = aStat && aStat.count > 0 ? Math.round(aStat.totalRate / aStat.count) : (DEFAULT_CLUB_APPROACH[c.name] || 75)

      result[c.name] = {
        avgDist,
        count: dStat ? dStat.count : 0,
        approachRate,
      }
    })

    return result
  }, [targetRoundsForClub, effectiveClubs])

  const targetBestApproachClub = useMemo<{ name: string; rate: number } | null>(() => {
    let best: { name: string; rate: number } | null = null
    Object.entries(targetClubStatsMap).forEach(([name, stat]) => {
      if (stat.approachRate > 0) {
        if (!best || stat.approachRate > best.rate) {
          best = { name, rate: stat.approachRate }
        }
      }
    })
    return best
  }, [targetClubStatsMap])

  let bestApproachClub: { name: string; rate: number } | null = null
  usedClubs.forEach((c) => {
    const stat = clubApproachMap[c.name]
    if (stat && stat.count > 0) {
      const rate = Math.round(stat.totalRate / stat.count)
      if (!bestApproachClub || rate > bestApproachClub.rate) {
        bestApproachClub = { name: c.name, rate }
      }
    }
  })

  // ==========================================
  // [2] 상세 통계 데이터 계산
  // ==========================================
  const par3Holes = holes.filter((h) => h.par === 3)
  const par4Holes = holes.filter((h) => h.par === 4)
  const par5Holes = holes.filter((h) => h.par === 5)
  const avgPar3 = par3Holes.length > 0 ? (par3Holes.reduce((acc, h) => acc + h.score, 0) / par3Holes.length).toFixed(2) : '3.00'
  const avgPar4 = par4Holes.length > 0 ? (par4Holes.reduce((acc, h) => acc + h.score, 0) / par4Holes.length).toFixed(2) : '4.00'
  const avgPar5 = par5Holes.length > 0 ? (par5Holes.reduce((acc, h) => acc + h.score, 0) / par5Holes.length).toFixed(2) : '5.00'

  const holeCount = holes.length || 1
  const birdieRate = ((holes.filter((h) => h.scoreDiff <= -1).length / holeCount) * 100).toFixed(1)
  const parRate = ((holes.filter((h) => h.scoreDiff === 0).length / holeCount) * 100).toFixed(1)
  const bogeyRate = ((holes.filter((h) => h.scoreDiff === 1).length / holeCount) * 100).toFixed(1)
  const doubleRate = ((holes.filter((h) => h.scoreDiff === 2).length / holeCount) * 100).toFixed(1)

  const totalPenalties = holes.flatMap((h) => h.shots || []).reduce((acc, s) => acc + (s.penalty || 0), 0)
  const penaltyRate = ((totalPenalties / holeCount) * 10).toFixed(1)

  const driverShots = holes.flatMap((h) => (h.shots || []).filter((s) => s.club === '드라이버' && s.shotNumber === 1 && s.shotDistance > 0))
  const maxDriverDist = driverShots.length > 0 ? Math.max(...driverShots.map((s) => s.shotDistance)) : 220
  const avgDriverDist = driverShots.length > 0 ? Math.round(driverShots.reduce((acc, s) => acc + s.shotDistance, 0) / driverShots.length) : 205
  const fwEligible = holes.filter((h) => h.fairwayHit !== null).length
  const fwHitCount = holes.filter((h) => h.fairwayHit === true).length
  const fwRate = savedRound?.fwPercent !== undefined ? savedRound.fwPercent : (fwEligible > 0 ? Math.round((fwHitCount / fwEligible) * 100) : 55)

  const girCount = holes.filter((h) => h.gir).length
  const girRate = savedRound?.girPercent !== undefined ? savedRound.girPercent : Math.round((girCount / holeCount) * 100)
  
  const approachShots = holes.flatMap((h) => {
    const maxGirShot = h.par - 2
    return (h.shots || []).filter((s) => s.shotNumber === maxGirShot)
  })
  const fwApproaches = approachShots.filter((s) => s.ballLie === '페어웨이')
  const roughApproaches = approachShots.filter((s) => s.ballLie === '러프')
  const bunkerApproaches = approachShots.filter((s) => s.ballLie === '벙커')
  const fwGirRate = fwApproaches.length > 0 ? Math.round((holes.filter((h) => h.gir && (h.shots?.[h.par - 3]?.ballLie === '페어웨이')).length / fwApproaches.length) * 100) : 60
  const roughGirRate = roughApproaches.length > 0 ? Math.round((holes.filter((h) => h.gir && (h.shots?.[h.par - 3]?.ballLie === '러프')).length / roughApproaches.length) * 100) : 35
  const bunkerGirRate = bunkerApproaches.length > 0 ? 15 : 10

  const nonGirHoles = holes.filter((h) => !h.gir)
  const parSaves = nonGirHoles.filter((h) => h.scoreDiff <= 0).length
  const scrambleRate = nonGirHoles.length > 0 ? Math.round((parSaves / nonGirHoles.length) * 100) : 50

  const bunkerHoles = holes.filter((h) => (h.shots || []).some((s) => s.ballLie === '벙커'))
  const bunkerSaves = bunkerHoles.filter((h) => h.scoreDiff <= 0).length
  const bunkerSaveRate = bunkerHoles.length > 0 ? Math.round((bunkerSaves / bunkerHoles.length) * 100) : 25

  const totalPutts = savedRound?.totalPutts !== undefined ? savedRound.totalPutts : holes.reduce((acc, h) => acc + (h.putts || 0), 0)
  const avgPutts = (totalPutts / holeCount).toFixed(2)
  const girHoles = holes.filter((h) => h.gir)
  const avgGirPutts = girHoles.length > 0 ? (girHoles.reduce((acc, h) => acc + (h.putts || 0), 0) / girHoles.length).toFixed(2) : '1.85'
  const onePuttCount = holes.filter((h) => h.putts === 1).length
  const twoPuttCount = holes.filter((h) => h.putts === 2).length
  const threePlusPuttCount = holes.filter((h) => h.putts >= 3).length

  // 사용자 로드 & 로컬 자동 저장
  useEffect(() => {
    if (typeof window === 'undefined') return
    const user = localStorage.getItem('golf_user') || 'guest'
    setCurrentUser(user)

    if (isHistoryView || savedRound) return

    const storageKey = `golf_rounds_${user}`
    const existingStr = localStorage.getItem(storageKey)
    let list: SavedRoundData[] = existingStr ? JSON.parse(existingStr) : []

    const currentRound: SavedRoundData = {
      id: `round_${Date.now()}`,
      date: roundDate,
      ccName: effectiveCcName,
      totalScore,
      totalPar,
      scoreDiff: totalDiff,
      girPercent: Number(girRate),
      fwPercent: Number(fwRate),
      totalPutts: Number(totalPutts),
      holes: holes,
    }

    const exists = list.some((r) => r.totalScore === totalScore && r.date === currentRound.date && r.holes.length === holes.length)
    if (!exists && holes.length > 0) {
      list = [currentRound, ...list]
      localStorage.setItem(storageKey, JSON.stringify(list))
    }
  }, [holes, totalScore, totalPar, totalDiff, girRate, fwRate, totalPutts, isHistoryView, savedRound, roundDate, effectiveCcName])

  // ==========================================
  // [3] 우세/열세 비교 뱃지 및 바 렌더링 헬퍼
  // ==========================================
  const renderCompareBadge = (myVal: number, avgVal: number, lowerIsBetter: boolean = false) => {
    if (!avgVal || avgVal === 0) {
      return (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 'bold',
            padding: '2px 6px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            color: '#64748b',
            backgroundColor: '#f1f5f9',
          }}
        >
          - 대등
        </span>
      )
    }

    const diffPercent = ((myVal - avgVal) / avgVal) * 100
    const diffRate = Math.abs(diffPercent).toFixed(1)

    const isAdvantage = lowerIsBetter ? diffPercent < -5 : diffPercent > 5
    const isBigAdvantage = lowerIsBetter ? diffPercent <= -15 : diffPercent >= 15
    const isDisadvantage = lowerIsBetter ? diffPercent > 5 : diffPercent < -5
    const isBigDisadvantage = lowerIsBetter ? diffPercent >= 15 : diffPercent <= -15

    const baseStyle: React.CSSProperties = {
      fontSize: '11px',
      fontWeight: 'bold',
      padding: '2px 6px',
      borderRadius: '4px',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }

    if (isBigAdvantage) {
      return <span style={{ ...baseStyle, color: '#dc2626', backgroundColor: '#fee2e2' }}>↑ {diffRate}% 우세</span>
    }
    if (isAdvantage) {
      return <span style={{ ...baseStyle, color: '#ea580c', backgroundColor: '#ffedd5' }}>↑ {diffRate}% 우세</span>
    }
    if (isBigDisadvantage) {
      return <span style={{ ...baseStyle, color: '#2563eb', backgroundColor: '#dbeafe' }}>↓ {diffRate}% 열세</span>
    }
    if (isDisadvantage) {
      return <span style={{ ...baseStyle, color: '#0284c7', backgroundColor: '#e0f2fe' }}>↓ {diffRate}% 열세</span>
    }
    return <span style={{ ...baseStyle, color: '#64748b', backgroundColor: '#f1f5f9' }}>- 대등</span>
  }

  // 동적 비교 대상명 및 바 색상 렌더링
  const renderDualBar = (
    label: string,
    myVal: number,
    targetVal: number,
    maxRange: number,
    unit: string = '',
    lowerIsBetter: boolean = false
  ) => {
    const myPct = myVal <= 0 ? 0 : Math.min(100, Math.max(2, (myVal / maxRange) * 100))
    const targetPct = targetVal <= 0 ? 0 : Math.min(100, Math.max(2, (targetVal / maxRange) * 100))

    const targetBarColor = activeBenchmark.badgeColor
    const compareTitle = activeBenchmark.isCustom ? activeBenchmark.targetLabel : '동급 평균'

    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'nowrap', gap: '4px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {renderCompareBadge(myVal, targetVal, lowerIsBetter)}
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#15803d', whiteSpace: 'nowrap' }}>{myVal}{unit}</span>
            <span style={{ fontSize: '10.5px', color: targetBarColor, whiteSpace: 'nowrap', fontWeight: 600 }}>
              (비교 {targetVal}{unit})
            </span>
          </div>
        </div>

        {/* 내 결과 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ width: '48px', fontSize: '11px', color: '#15803d', fontWeight: 600, flexShrink: 0 }}>내 결과</span>
          <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
            <div style={{ width: `${myPct}%`, backgroundColor: '#16a34a', height: '100%', borderRadius: '7px', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* 비교 대상 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '48px',
              fontSize: '11px',
              color: targetBarColor,
              fontWeight: 600,
              flexShrink: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={compareTitle}
          >
            {compareMode === 'benchmark' ? '평균값' : compareMode === 'my' ? '내과거' : '친구'}
          </span>
          <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
            <div style={{ width: `${targetPct}%`, backgroundColor: targetBarColor, height: '100%', borderRadius: '7px', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>
    )
  }

  // 탭 목록 정의
  const TABS: { id: AnalysisTab; label: string; icon: string }[] = [
    { id: 'score', label: '스코어 분석', icon: '🎯' },
    { id: 'driver', label: '드라이버 분석', icon: '🏌️' },
    { id: 'club', label: '클럽별 분석', icon: '📊' },
    { id: 'gir', label: '그린적중 분석', icon: '⛳' },
    { id: 'shortgame', label: '숏게임 분석', icon: '🏖️' },
    { id: 'putting', label: '퍼팅 분석', icon: '🕳️' },
  ]

  // ==========================================
  // [모달용 필터링 및 정렬된 라운드 목록]
  // ==========================================
  const modalTargetRounds = useMemo(() => {
    let list: (SavedRoundData & { ownerName?: string })[] = []
    if (compareMode === 'my') {
      list = myMatchingRounds.map((r) => ({ ...r, ownerName: '나' }))
    } else if (compareMode === 'friend') {
      list = currentFriendRounds.map((r) => ({ ...r, ownerName: r.userName }))
    }

    if (modalSearchText.trim()) {
      const q = modalSearchText.trim().toLowerCase()
      list = list.filter((r) => r.date.toLowerCase().includes(q) || (r.ownerName && r.ownerName.toLowerCase().includes(q)))
    }

    return [...list].sort((a, b) => {
      if (modalSortOrder === 'lowestScore') return a.totalScore - b.totalScore
      if (modalSortOrder === 'highestScore') return b.totalScore - a.totalScore
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [compareMode, myMatchingRounds, currentFriendRounds, modalSearchText, modalSortOrder])

  const myBestRoundId = useMemo(() => {
    if (myMatchingRounds.length === 0) return null
    return [...myMatchingRounds].sort((a, b) => a.totalScore - b.totalScore)[0]?.id
  }, [myMatchingRounds])

  const friendBestRoundId = useMemo(() => {
    if (currentFriendRounds.length === 0) return null
    return [...currentFriendRounds].sort((a, b) => a.totalScore - b.totalScore)[0]?.id
  }, [currentFriendRounds])

  return (
    <div style={{ padding: isHistoryView ? '0' : '16px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 0. 상단 액션 바 */}
      {isHistoryView || savedRound ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 16px',
              backgroundColor: '#334155',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ← 라운드 히스토리 목록으로
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontWeight: 'bold' }}>
              ⛳ {effectiveCcName}
            </span>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              📅 {roundDate}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onBackToScore}
              style={{ padding: '9px 16px', backgroundColor: '#475569', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ↩ 샷 기록 수정
            </button>
            <span style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontWeight: 'bold' }}>
              ⛳ {effectiveCcName}
            </span>
          </div>
          <button
            onClick={onStartNewRound}
            style={{ padding: '9px 16px', backgroundColor: '#047857', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ⛳ 새 라운드 시작
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🌟 비교 기준 선택 컨트롤러 (동급평균 / 내기록 / 친구기록) */}
      {/* ======================================================== */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '14px 16px',
          marginBottom: '16px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Comparison Mode · 동일 CC 맞춤 비교
            </div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', marginTop: '2px' }}>
              누구의 기록과 비교하시겠습니까?
            </div>
          </div>
          <span style={{ fontSize: '11.5px', color: '#64748b', backgroundColor: '#f8fafc', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            기준 CC: <strong>{effectiveCcName}</strong>
          </span>
        </div>

        {/* 1단계: 메인 모드 선택 세그먼트 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
          
          {/* A. 동급 골퍼 평균 (기본값) */}
          <button
            onClick={() => {
              setCompareMode('benchmark')
              setSelectedQuickFilter('recent')
              setSelectedRoundId(null)
            }}
            style={{
              padding: '10px 8px',
              borderRadius: '10px',
              border: compareMode === 'benchmark' ? '2px solid #0f172a' : '1px solid #e2e8f0',
              backgroundColor: compareMode === 'benchmark' ? '#0f172a' : '#f8fafc',
              color: compareMode === 'benchmark' ? '#ffffff' : '#475569',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s',
            }}
          >
            <span>👥 동급 평균 (기본)</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>핸디캡 유사 그룹</span>
          </button>

          {/* B. 나의 기록 */}
          <button
            onClick={() => {
              setCompareMode('my')
              setSelectedQuickFilter('recent')
              setSelectedRoundId(null)
            }}
            style={{
              padding: '10px 8px',
              borderRadius: '10px',
              border: compareMode === 'my' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
              backgroundColor: compareMode === 'my' ? '#f5f3ff' : '#f8fafc',
              color: compareMode === 'my' ? '#6d28d9' : '#475569',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>👤 나의 기록</span>
              <span
                style={{
                  fontSize: '9.5px',
                  backgroundColor: compareMode === 'my' ? '#7c3aed' : '#cbd5e1',
                  color: '#ffffff',
                  padding: '1px 5px',
                  borderRadius: '10px',
                }}
              >
                {myMatchingRounds.length}
              </span>
            </div>
            <span style={{ fontSize: '10px', opacity: 0.85 }}>과거 이 코스 기록</span>
          </button>

          {/* C. 친구의 기록 */}
          <button
            onClick={() => {
              setCompareMode('friend')
              setSelectedQuickFilter('recent')
              setSelectedRoundId(null)
            }}
            style={{
              padding: '10px 8px',
              borderRadius: '10px',
              border: compareMode === 'friend' ? '2px solid #2563eb' : '1px solid #e2e8f0',
              backgroundColor: compareMode === 'friend' ? '#eff6ff' : '#f8fafc',
              color: compareMode === 'friend' ? '#1d4ed8' : '#475569',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>🏌️ 친구의 기록</span>
              <span
                style={{
                  fontSize: '9.5px',
                  backgroundColor: compareMode === 'friend' ? '#2563eb' : '#cbd5e1',
                  color: '#ffffff',
                  padding: '1px 5px',
                  borderRadius: '10px',
                }}
              >
                {friendsMatchingRounds.length}
              </span>
            </div>
            <span style={{ fontSize: '10px', opacity: 0.85 }}>{availableFriends.length}명의 친구</span>
          </button>

        </div>

        {/* 2단계: 모드별 하위 퀵 셀렉터 */}
        {compareMode === 'benchmark' && (
          <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>✓ 현재 나와 유사한 핸디캡 그룹의 <strong>표준 통계치({DEFAULT_BENCHMARK.score}타)</strong>와 비교 중입니다.</span>
            <span style={{ color: '#0f172a', fontWeight: 'bold' }}>기준 타수: {DEFAULT_BENCHMARK.score}타</span>
          </div>
        )}

        {compareMode === 'my' && (
          <div>
            {myMatchingRounds.length === 0 ? (
              <div style={{ padding: '10px', textAlign: 'center', fontSize: '12.5px', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                동일한 CC ({effectiveCcName})에서의 이전 라운드 기록이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#7c3aed', marginRight: '4px' }}>
                  빠른 선택:
                </span>
                <button
                  onClick={() => { setSelectedQuickFilter('recent'); setSelectedRoundId(null); }}
                  style={{
                    padding: '6px 11px', borderRadius: '20px',
                    border: selectedQuickFilter === 'recent' ? '1.5px solid #7c3aed' : '1px solid #ddd6fe',
                    backgroundColor: selectedQuickFilter === 'recent' ? '#7c3aed' : '#ffffff',
                    color: selectedQuickFilter === 'recent' ? '#ffffff' : '#6d28d9',
                    fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  ⚡ 직전 라운드
                </button>
                <button
                  onClick={() => { setSelectedQuickFilter('best'); setSelectedRoundId(null); }}
                  style={{
                    padding: '6px 11px', borderRadius: '20px',
                    border: selectedQuickFilter === 'best' ? '1.5px solid #7c3aed' : '1px solid #ddd6fe',
                    backgroundColor: selectedQuickFilter === 'best' ? '#7c3aed' : '#ffffff',
                    color: selectedQuickFilter === 'best' ? '#ffffff' : '#6d28d9',
                    fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  🏆 내 코스 베스트(라베)
                </button>
                <button
                  onClick={() => { setSelectedQuickFilter('course_avg'); setSelectedRoundId(null); }}
                  style={{
                    padding: '6px 11px', borderRadius: '20px',
                    border: selectedQuickFilter === 'course_avg' ? '1.5px solid #7c3aed' : '1px solid #ddd6fe',
                    backgroundColor: selectedQuickFilter === 'course_avg' ? '#7c3aed' : '#ffffff',
                    color: selectedQuickFilter === 'course_avg' ? '#ffffff' : '#6d28d9',
                    fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  📊 이 코스 내 평균 ({myMatchingRounds.length}회)
                </button>
                <button
                  onClick={() => setIsModalOpen(true)}
                  style={{
                    padding: '6px 12px', borderRadius: '20px',
                    border: selectedQuickFilter === 'custom' ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                    backgroundColor: selectedQuickFilter === 'custom' ? '#ede9fe' : '#f1f5f9',
                    color: selectedQuickFilter === 'custom' ? '#6d28d9' : '#334155',
                    fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer', marginLeft: 'auto',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  🔍 전체 목록에서 선택 ({myMatchingRounds.length}개)...
                </button>
              </div>
            )}
          </div>
        )}

        {compareMode === 'friend' && (
          <div>
            {friendsMatchingRounds.length === 0 ? (
              <div style={{ padding: '10px', textAlign: 'center', fontSize: '12.5px', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                동일한 CC ({effectiveCcName})에서의 친구 라운드 기록이 없습니다.
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#2563eb', flexShrink: 0 }}>
                    친구 선택:
                  </span>
                  {availableFriends.map((friend) => {
                    const isSelected = selectedFriendId === friend.id
                    const friendRoundCount = friendsMatchingRounds.filter((r) => r.userId === friend.id).length
                    return (
                      <button
                        key={friend.id}
                        onClick={() => { setSelectedFriendId(friend.id); setSelectedRoundId(null); }}
                        style={{
                          padding: '5px 10px', borderRadius: '8px',
                          border: isSelected ? '1.5px solid #2563eb' : '1px solid #bfdbfe',
                          backgroundColor: isSelected ? '#2563eb' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#1e40af',
                          fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', gap: '4px',
                        }}
                      >
                        <span>{friend.name}</span>
                        <span style={{ fontSize: '9.5px', backgroundColor: isSelected ? '#1d4ed8' : '#e0f2fe', color: isSelected ? '#ffffff' : '#0369a1', padding: '1px 4px', borderRadius: '4px' }}>
                          {friendRoundCount}회
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setSelectedQuickFilter('recent'); setSelectedRoundId(null); }}
                    style={{
                      padding: '6px 11px', borderRadius: '20px',
                      border: selectedQuickFilter === 'recent' ? '1.5px solid #2563eb' : '1px solid #bfdbfe',
                      backgroundColor: selectedQuickFilter === 'recent' ? '#2563eb' : '#ffffff',
                      color: selectedQuickFilter === 'recent' ? '#ffffff' : '#1d4ed8',
                      fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ⚡ 친구 최근 라운드
                  </button>
                  <button
                    onClick={() => { setSelectedQuickFilter('best'); setSelectedRoundId(null); }}
                    style={{
                      padding: '6px 11px', borderRadius: '20px',
                      border: selectedQuickFilter === 'best' ? '1.5px solid #2563eb' : '1px solid #bfdbfe',
                      backgroundColor: selectedQuickFilter === 'best' ? '#2563eb' : '#ffffff',
                      color: selectedQuickFilter === 'best' ? '#ffffff' : '#1d4ed8',
                      fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    🏆 친구 코스 베스트
                  </button>
                  <button
                    onClick={() => { setSelectedQuickFilter('course_avg'); setSelectedRoundId(null); }}
                    style={{
                      padding: '6px 11px', borderRadius: '20px',
                      border: selectedQuickFilter === 'course_avg' ? '1.5px solid #2563eb' : '1px solid #bfdbfe',
                      backgroundColor: selectedQuickFilter === 'course_avg' ? '#2563eb' : '#ffffff',
                      color: selectedQuickFilter === 'course_avg' ? '#ffffff' : '#1d4ed8',
                      fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    📊 친구 코스 평균 ({currentFriendRounds.length}회)
                  </button>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    style={{
                      padding: '6px 12px', borderRadius: '20px',
                      border: selectedQuickFilter === 'custom' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: selectedQuickFilter === 'custom' ? '#dbeafe' : '#f1f5f9',
                      color: selectedQuickFilter === 'custom' ? '#1d4ed8' : '#334155',
                      fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer', marginLeft: 'auto',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    🔍 기록 목록 선택 ({currentFriendRounds.length}개)...
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3단계: 현재 적용된 비교 대상 가시화 배너 */}
        {activeBenchmark.isCustom && (
          <div
            style={{
              marginTop: '12px', padding: '8px 12px',
              backgroundColor: compareMode === 'my' ? '#faf5ff' : '#eff6ff',
              borderRadius: '8px',
              border: `1px solid ${compareMode === 'my' ? '#e9d5ff' : '#bfdbfe'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  backgroundColor: activeBenchmark.badgeColor,
                  color: '#ffffff',
                  fontSize: '10.5px',
                  fontWeight: 'bold',
                  padding: '2px 7px',
                  borderRadius: '4px',
                }}
              >
                비교 중
              </span>
              <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#0f172a' }}>
                {activeBenchmark.targetLabel}
              </span>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                ({activeBenchmark.subLabel})
              </span>
            </div>

            <button
              onClick={() => {
                setCompareMode('benchmark')
                setSelectedQuickFilter('recent')
                setSelectedRoundId(null)
              }}
              style={{
                fontSize: '11px', color: '#64748b', background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline', padding: '2px 4px',
              }}
            >
              기본 동급 평균으로 초기화 ✕
            </button>
          </div>
        )}
      </div>

      {/* 1. 라운드 최종 요약 대형 카드 */}
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '20px 22px',
          marginBottom: '16px',
          boxShadow: '0 8px 20px -4px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
              {currentUser} 골퍼의 라운드 분석 리포트 · {effectiveCcName}
            </div>
            <h1 style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 'bold', color: '#ffffff' }}>
              최종 스코어 {totalScore}타
              <span style={{ fontSize: '17px', color: totalDiff <= 0 ? '#4ade80' : '#f87171', marginLeft: '8px' }}>
                ({totalDiff === 0 ? 'E' : totalDiff > 0 ? `+${totalDiff}` : totalDiff})
              </span>
            </h1>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: '#94a3b8' }}>
            <div>기준 PAR {totalPar}</div>
            <div style={{ color: '#38bdf8', marginTop: '2px', fontWeight: 600 }}>18홀 완주</div>
            <div style={{ marginTop: '4px', fontSize: '11px', color: activeBenchmark.badgeColor === '#64748b' ? '#cbd5e1' : '#fde047', fontWeight: 'bold' }}>
              vs {activeBenchmark.targetLabel.slice(0, 10)}... (
              {totalScore - benchmark.score > 0
                ? `+${(totalScore - benchmark.score).toFixed(1)}타 열세`
                : `${Math.abs(totalScore - benchmark.score).toFixed(1)}타 우세`}
              )
            </div>
          </div>
        </div>

        {/* 4대 주요 지표 요약 바 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '10px 2px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '10.5px', color: '#94a3b8', whiteSpace: 'nowrap', letterSpacing: '-0.5px', fontWeight: 500 }}>
              페어웨이 적중률
            </div>
            <div style={{ fontSize: '16.5px', fontWeight: 'bold', color: '#34d399', marginTop: '3px', whiteSpace: 'nowrap' }}>
              {fwRate}%
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
              비교 {benchmark.fwRate}%
            </div>
          </div>

          <div style={{ backgroundColor: '#1e293b', padding: '10px 2px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '10.5px', color: '#94a3b8', whiteSpace: 'nowrap', letterSpacing: '-0.5px', fontWeight: 500 }}>
              그린적중(GIR)
            </div>
            <div style={{ fontSize: '16.5px', fontWeight: 'bold', color: '#fbbf24', marginTop: '3px', whiteSpace: 'nowrap' }}>
              {girRate}%
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
              비교 {benchmark.girRate}%
            </div>
          </div>

          <div style={{ backgroundColor: '#1e293b', padding: '10px 2px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '10.5px', color: '#94a3b8', whiteSpace: 'nowrap', letterSpacing: '-0.5px', fontWeight: 500 }}>
              총 퍼팅
            </div>
            <div style={{ fontSize: '16.5px', fontWeight: 'bold', color: '#38bdf8', marginTop: '3px', whiteSpace: 'nowrap' }}>
              {totalPutts}개
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
              비교 {benchmark.totalPutts}개
            </div>
          </div>

          <div style={{ backgroundColor: '#1e293b', padding: '10px 2px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '10.5px', color: '#94a3b8', whiteSpace: 'nowrap', letterSpacing: '-0.5px', fontWeight: 500 }}>
              파 세이브율
            </div>
            <div style={{ fontSize: '16.5px', fontWeight: 'bold', color: '#a78bfa', marginTop: '3px', whiteSpace: 'nowrap' }}>
              {scrambleRate}%
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
              비교 {benchmark.scrambleRate}%
            </div>
          </div>
        </div>
      </div>

      {/* 2. 6대 상세항목 분석 네비게이션 탭 */}
      <div
        style={{
          display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px',
          marginBottom: '14px', position: 'sticky', top: 0, backgroundColor: '#ffffff',
          zIndex: 10, paddingTop: '4px',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: '1 0 auto', padding: '10px 14px', borderRadius: '8px',
                border: isActive ? '2px solid #047857' : '1px solid #cbd5e1',
                backgroundColor: isActive ? '#047857' : '#ffffff',
                color: isActive ? '#ffffff' : '#334155',
                fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
                boxShadow: isActive ? '0 2px 5px rgba(4,120,87,0.2)' : 'none',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* 3. 선택된 탭별 상세 분석 데이터 카드 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px', marginBottom: '20px' }}>
        
        {/* [TAB 1] 스코어 분석 */}
        {activeTab === 'score' && (
          <div>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                🎯 스코어 및 기준 PAR별 분석
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                {activeBenchmark.targetLabel} ({benchmark.score}타) 대비 홀별 파 세이브 및 득실 분석
              </p>
            </div>

            {renderDualBar('최종 스코어 타수', totalScore, benchmark.score, 120, '타', true)}
            {renderDualBar('파3홀 평균 타수', Number(avgPar3), benchmark.par3, 6, '타', true)}
            {renderDualBar('파4홀 평균 타수', Number(avgPar4), benchmark.par4, 7, '타', true)}
            {renderDualBar('파5홀 평균 타수', Number(avgPar5), benchmark.par5, 8, '타', true)}

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px' }}>
                홀 단위 기록 달성률 (%)
              </div>
              {renderDualBar('버디 이하 기록 달성률', Number(birdieRate), benchmark.birdieRate, 50, '%', false)}
              {renderDualBar('파(Par) 기록 달성률', Number(parRate), benchmark.parRate, 80, '%', false)}
              {renderDualBar('보기 기록 달성률', Number(bogeyRate), benchmark.bogeyRate, 60, '%', true)}
              {renderDualBar('더블보기 기록 달성률', Number(doubleRate), benchmark.doubleRate, 40, '%', true)}
              {renderDualBar('벌타 발생 비율', Number(penaltyRate), benchmark.penaltyRate, 20, '%', true)}
            </div>
          </div>
        )}

        {/* [TAB 2] 드라이버 티샷 분석 */}
        {activeTab === 'driver' && (
          <div>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                🏌️ 드라이버 티샷 비거리 및 정확도
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                {activeBenchmark.targetLabel} 대비 티샷의 안정성과 페어웨이 적중률 및 최장타 기록 비교
              </p>
            </div>

            {renderDualBar('티샷 최대 비거리(롱기스트)', maxDriverDist, benchmark.driverMax, 320, 'm', false)}
            {renderDualBar('티샷 평균 비거리', avgDriverDist, benchmark.driverAvg, 280, 'm', false)}
            {renderDualBar('페어웨이 안착률 (FW%)', Number(fwRate), benchmark.fwRate, 100, '%', false)}
            {renderDualBar('티샷 벌타율(OB/해저드)', Number(penaltyRate), benchmark.penaltyRate, 20, '%', true)}

            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px', color: '#475569' }}>
              💡 <strong>드라이버 진단</strong>: 오늘 페어웨이 안착률({fwRate}%)은 {activeBenchmark.targetLabel}({benchmark.fwRate}%) 대비 <strong>{Number(fwRate) >= benchmark.fwRate ? '안정적인 티샷을 유지' : '미스샷 관리가 필요'}</strong>했습니다.
            </div>
          </div>
        )}

        {/* [TAB 3] 🌟 클럽별 비거리 & 접근율 분석 탭 (다른 분석들과 100% 동일한 듀얼 바 비교 UI 적용) */}
        {activeTab === 'club' && (
          <div>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                📊 클럽별 비거리 및 핀 접근율 비교 분석
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                {activeBenchmark.targetLabel} 대비 클럽별 평균 비거리와 핀 공략 정밀도(접근율) 실시간 1:1 비교
              </p>
            </div>

            {/* 1. 상단 2대 핵심 접근율 요약 카드 (내 기록 vs 비교 대상) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>전체 핀 평균 접근율</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#15803d', marginTop: '2px' }}>
                  {overallAvgApproach}%
                </div>
                <div style={{ fontSize: '10.5px', color: '#059669', marginTop: '2px' }}>
                  비교 ({benchmark.approachRate}%) 대비 {overallAvgApproach >= benchmark.approachRate ? '우세' : '열세'}
                </div>
              </div>

              <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>최고 접근율 클럽 비교</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1d4ed8', marginTop: '4px' }}>
                  {bestApproachClub ? (bestApproachClub as any).name : '-'}
                  <span style={{ fontSize: '12px', color: '#2563eb', marginLeft: '4px' }}>
                    ({bestApproachClub ? `${(bestApproachClub as any).rate}%` : '-'})
                  </span>
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '3px' }}>
                  비교: {targetBestApproachClub ? `${targetBestApproachClub.name} (${targetBestApproachClub.rate}%)` : '-'}
                </div>
              </div>
            </div>

            {/* 2. 전체 핀 접근율 듀얼 바 비교 */}
            <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              {renderDualBar('전체 핀 평균 접근율', overallAvgApproach, benchmark.approachRate, 100, '%', false)}
            </div>

            {/* 3. 클럽별 비교 필터 툴바 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              {/* 카테고리 필터 */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { id: 'all', label: '전체 클럽' },
                  { id: 'wood', label: '우드·유틸' },
                  { id: 'iron', label: '아이언' },
                  { id: 'wedge', label: '웨지' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setClubCategoryFilter(cat.id as any)}
                    style={{
                      padding: '5px 9px',
                      borderRadius: '6px',
                      border: clubCategoryFilter === cat.id ? '1px solid #0f172a' : '1px solid #e2e8f0',
                      backgroundColor: clubCategoryFilter === cat.id ? '#0f172a' : '#ffffff',
                      color: clubCategoryFilter === cat.id ? '#ffffff' : '#64748b',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* 지표 필터: 통합 / 비거리 / 접근율 */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { id: 'both', label: '통합 보기' },
                  { id: 'distance', label: '📏 비거리' },
                  { id: 'approach', label: '🎯 접근율' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setClubMetricMode(mode.id as any)}
                    style={{
                      padding: '5px 9px',
                      borderRadius: '6px',
                      border: clubMetricMode === mode.id ? '1.5px solid #047857' : '1px solid #cbd5e1',
                      backgroundColor: clubMetricMode === mode.id ? '#ecfdf5' : '#ffffff',
                      color: clubMetricMode === mode.id ? '#047857' : '#475569',
                      fontSize: '11.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. 클럽별 듀얼 바 비교 리스트 (다른 분석들과 100% 동일한 DualBar) */}
            {usedClubs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: '13px' }}>
                기록된 클럽 샷 데이터가 없습니다.
              </div>
            ) : (
              <div>
                {/* A. 클럽별 평균 비거리 비교 섹션 */}
                {(clubMetricMode === 'both' || clubMetricMode === 'distance') && (
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📏 클럽별 평균 비거리 비교 (m)</span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>
                        * 내 샷 평균 vs {activeBenchmark.targetLabel}
                      </span>
                    </div>

                    {usedClubs
                      .filter((c) => {
                        if (clubCategoryFilter === 'wood') return c.category === 'wood' || c.category === 'driver' || c.category === 'utility'
                        if (clubCategoryFilter === 'iron') return c.category === 'iron'
                        if (clubCategoryFilter === 'wedge') return c.category === 'wedge'
                        return true
                      })
                      .map((c) => {
                        const myStat = clubStatsMap[c.name]
                        const myAvgDist = Math.round(myStat.totalDist / myStat.count)
                        const targetStat = targetClubStatsMap[c.name]
                        const targetAvgDist = targetStat ? targetStat.avgDist : (DEFAULT_CLUB_DISTANCES[c.name] || 130)
                        const maxRange = c.category === 'driver' ? 320 : c.category === 'wood' || c.category === 'utility' ? 260 : 220

                        return (
                          <div key={`dist_${c.id}`}>
                            {renderDualBar(
                              `${c.name} 평균 비거리`,
                              myAvgDist,
                              targetAvgDist,
                              maxRange,
                              'm',
                              false
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}

                {/* B. 클럽별 핀 접근율(%) 비교 섹션 */}
                {(clubMetricMode === 'both' || clubMetricMode === 'approach') && (
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🎯 클럽별 핀 접근율 비교 (%)</span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>
                        * 핀 공략 정밀도 (높을수록 우세)
                      </span>
                    </div>

                    {usedClubs
                      .filter((c) => {
                        if (clubCategoryFilter === 'wood') return c.category === 'wood' || c.category === 'driver' || c.category === 'utility'
                        if (clubCategoryFilter === 'iron') return c.category === 'iron'
                        if (clubCategoryFilter === 'wedge') return c.category === 'wedge'
                        return true
                      })
                      .map((c) => {
                        const myAppStat = clubApproachMap[c.name]
                        const myApproachRate = myAppStat && myAppStat.count > 0 ? Math.round(myAppStat.totalRate / myAppStat.count) : 0
                        const targetStat = targetClubStatsMap[c.name]
                        const targetApproachRate = targetStat ? targetStat.approachRate : (DEFAULT_CLUB_APPROACH[c.name] || 75)

                        return (
                          <div key={`app_${c.id}`}>
                            {renderDualBar(
                              `${c.name} 핀 접근율`,
                              myApproachRate,
                              targetApproachRate,
                              100,
                              '%',
                              false
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}

                {/* C. 클럽별 종합 비교 테이블 */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', marginBottom: '10px' }}>
                    📋 클럽별 종합 비교 데이터 시트
                  </div>
                  <table
                    style={{
                      width: '100%',
                      tableLayout: 'fixed',
                      fontSize: '12px',
                      borderCollapse: 'collapse',
                      textAlign: 'center',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: '#f8fafc',
                          color: '#475569',
                          borderBottom: '1.5px solid #e2e8f0',
                          height: '34px',
                        }}
                      >
                        <th style={{ padding: '6px 2px', fontWeight: 'bold', width: '22%' }}>클럽</th>
                        <th style={{ padding: '6px 2px', fontWeight: 'bold', width: '13%' }}>샷횟수</th>
                        <th style={{ padding: '6px 2px', fontWeight: 'bold', width: '32%' }}>비거리 (내결과 vs 비교)</th>
                        <th style={{ padding: '6px 2px', fontWeight: 'bold', width: '33%' }}>접근율 (내결과 vs 비교)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usedClubs.map((c) => {
                        const myStat = clubStatsMap[c.name]
                        const myAvgDist = Math.round(myStat.totalDist / myStat.count)
                        const targetStat = targetClubStatsMap[c.name]
                        const targetAvgDist = targetStat ? targetStat.avgDist : (DEFAULT_CLUB_DISTANCES[c.name] || 130)

                        const myAppStat = clubApproachMap[c.name]
                        const myApproachRate = myAppStat && myAppStat.count > 0 ? Math.round(myAppStat.totalRate / myAppStat.count) : null
                        const targetApproachRate = targetStat ? targetStat.approachRate : (DEFAULT_CLUB_APPROACH[c.name] || 75)

                        return (
                          <tr
                            key={c.id}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              height: '44px',
                            }}
                          >
                            <td style={{ padding: '6px 2px', fontWeight: 'bold', color: '#0f172a', fontSize: '12px' }}>
                              {c.name}
                            </td>
                            <td style={{ padding: '6px 2px', color: '#64748b', fontSize: '11px' }}>
                              {myStat.count}회
                            </td>
                            <td style={{ padding: '6px 2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 'bold', color: '#047857' }}>{myAvgDist}m</span>
                                <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>vs</span>
                                <span style={{ fontSize: '11px', color: activeBenchmark.badgeColor, fontWeight: 600 }}>{targetAvgDist}m</span>
                                {renderCompareBadge(myAvgDist, targetAvgDist, false)}
                              </div>
                            </td>
                            <td style={{ padding: '6px 2px' }}>
                              {myApproachRate !== null ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 'bold', color: '#2563eb' }}>{myApproachRate}%</span>
                                  <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>vs</span>
                                  <span style={{ fontSize: '11px', color: activeBenchmark.badgeColor, fontWeight: 600 }}>{targetApproachRate}%</span>
                                  {renderCompareBadge(myApproachRate, targetApproachRate, false)}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* [TAB 4] 그린 적중 (GIR) 및 접근율 분석 */}
        {activeTab === 'gir' && (
          <div>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                ⛳ 그린 적중률 (GIR) 및 핀 접근율
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                {activeBenchmark.targetLabel} 대비 온그린 성공률과 핀 접근율 지표 비교
              </p>
            </div>

            {renderDualBar('전체 그린 적중률 (GIR)', Number(girRate), benchmark.girRate, 100, '%', false)}
            {renderDualBar('전체 핀 평균 접근율', overallAvgApproach, benchmark.approachRate, 100, '%', false)}
            {renderDualBar('페어웨이 세컨샷 GIR', fwGirRate, benchmark.fwGirRate, 100, '%', false)}
            {renderDualBar('러프 탈출 세컨샷 GIR', roughGirRate, benchmark.roughGirRate, 100, '%', false)}
            {renderDualBar('벙커 세컨샷 GIR', bunkerGirRate, benchmark.bunkerGirRate, 100, '%', false)}

            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '12.5px', color: '#1e40af' }}>
              💡 <strong>세컨샷 인사이트</strong>: 오늘 핀 평균 접근율은 <strong>{overallAvgApproach}%</strong>({activeBenchmark.targetLabel} {benchmark.approachRate}%)를 기록했습니다. 각 클럽별 정밀 접근율은 상단 <strong>[📊 클럽별 분석]</strong> 탭에서 확인하실 수 있습니다.
            </div>
          </div>
        )}

        {/* [TAB 5] 숏게임 분석 */}
        {activeTab === 'shortgame' && (
          <div>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                🏖️ 숏게임 세이브율 (Scrambling)
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                GIR 실패 홀에서 파 이상을 지켜내는 위기관리 능력
              </p>
            </div>

            {renderDualBar('스크램블링 파 세이브율', scrambleRate, benchmark.scrambleRate, 100, '%', false)}
            {renderDualBar('벙커 세이브율 (Sand Save)', bunkerSaveRate, benchmark.bunkerSaveRate, 100, '%', false)}

            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'center' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>파 세이브 성공</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#16a34a', marginTop: '2px' }}>{parSaves} / {nonGirHoles.length}홀</div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>벙커 세이브 성공</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#d97706', marginTop: '2px' }}>{bunkerSaves} / {bunkerHoles.length || 1}홀</div>
              </div>
            </div>
          </div>
        )}

        {/* [TAB 6] 퍼팅 분석 */}
        {activeTab === 'putting' && (
          <div>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                🕳️ 퍼팅 통계 및 거리별 정확도
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                {activeBenchmark.targetLabel} 대비 온그린 시 퍼트 수와 1/2/3퍼트 분포 현황
              </p>
            </div>

            {renderDualBar('홀당 평균 퍼트 수', Number(avgPutts), benchmark.avgPutts, 3.5, '개', true)}
            {renderDualBar('그린 적중(GIR) 시 퍼트 수', Number(avgGirPutts), benchmark.girPutts, 3.5, '개', true)}
            {renderDualBar('18홀 총 퍼팅 수', totalPutts, benchmark.totalPutts, 50, '개', true)}

            {/* 퍼트 분포 상세 */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', marginBottom: '10px' }}>
                퍼트 횟수별 홀 수 분포
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                
                {/* 1. 원퍼트 */}
                <div
                  style={{
                    backgroundColor: '#f0fdf4',
                    padding: '10px 4px',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534', whiteSpace: 'nowrap' }}>
                    원퍼트
                  </div>
                  <div style={{ fontSize: '10px', color: '#15803d', marginTop: '1px', whiteSpace: 'nowrap' }}>
                    (1-Putt)
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#15803d', marginTop: '4px', whiteSpace: 'nowrap' }}>
                    {onePuttCount}홀
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
                    비교 {benchmark.onePutt}홀
                  </div>
                </div>

                {/* 2. 투퍼트 */}
                <div
                  style={{
                    backgroundColor: '#eff6ff',
                    padding: '10px 4px',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e40af', whiteSpace: 'nowrap' }}>
                    투퍼트
                  </div>
                  <div style={{ fontSize: '10px', color: '#1d4ed8', marginTop: '1px', whiteSpace: 'nowrap' }}>
                    (2-Putt)
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1d4ed8', marginTop: '4px', whiteSpace: 'nowrap' }}>
                    {twoPuttCount}홀
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
                    비교 {benchmark.twoPutt}홀
                  </div>
                </div>

                {/* 3. 쓰리퍼트+ */}
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    padding: '10px 4px',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#991b1b', whiteSpace: 'nowrap' }}>
                    쓰리퍼트+
                  </div>
                  <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '1px', whiteSpace: 'nowrap' }}>
                    (3-Putt+)
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c', marginTop: '4px', whiteSpace: 'nowrap' }}>
                    {threePlusPuttCount}홀
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
                    비교 {benchmark.threePutt}홀
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>

      {/* 4. 18홀 상세 스코어카드 테이블 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '20px', overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>
          📋 18홀 스코어카드 복기
        </h3>

        {/* 전반 1~9H */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>전반 코스 (1~9H)</div>
          <table style={{ width: '100%', tableLayout: 'fixed', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'center', border: '1px solid #cbd5e1' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ padding: '6px' }}>홀</th>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => <th key={h} style={{ padding: '6px' }}>{h}</th>)}
                <th style={{ padding: '6px', backgroundColor: '#e2e8f0' }}>전반</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '6px', fontWeight: 600 }}>Par</td>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => {
                  const record = holes.find((r) => r.holeNumber === h)
                  return <td key={h} style={{ padding: '6px' }}>{record ? record.par : holePars[h - 1] || 4}</td>
                })}
                <td style={{ padding: '6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>
                  {holePars.slice(0, 9).reduce((a, b) => a + b, 0)}
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f0fdf4' }}>
                <td style={{ padding: '6px', fontWeight: 'bold' }}>Score</td>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => {
                  const record = holes.find((r) => r.holeNumber === h)
                  if (!record) return <td key={h} style={{ padding: '6px' }}>-</td>
                  const diff = record.scoreDiff
                  return (
                    <td key={h} style={{ padding: '6px', fontWeight: 'bold', color: diff <= 0 ? '#15803d' : '#b91c1c' }}>
                      {diff === 0 ? '0' : diff > 0 ? `+${diff}` : diff}
                    </td>
                  )
                })}
                <td style={{ padding: '6px', fontWeight: 'bold', backgroundColor: '#dcfce7' }}>
                  {holes.filter((r) => r.holeNumber <= 9).reduce((acc, r) => acc + r.score, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 후반 10~18H */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>후반 코스 (10~18H)</div>
          <table style={{ width: '100%', tableLayout: 'fixed', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'center', border: '1px solid #cbd5e1' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ padding: '6px' }}>홀</th>
                {[10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => <th key={h} style={{ padding: '6px' }}>{h}</th>)}
                <th style={{ padding: '6px', backgroundColor: '#e2e8f0' }}>후반</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '6px', fontWeight: 600 }}>Par</td>
                {[10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => {
                  const record = holes.find((r) => r.holeNumber === h)
                  return <td key={h} style={{ padding: '6px' }}>{record ? record.par : holePars[h - 1] || 4}</td>
                })}
                <td style={{ padding: '6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>
                  {holePars.slice(9, 18).reduce((a, b) => a + b, 0)}
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f0fdf4' }}>
                <td style={{ padding: '6px', fontWeight: 'bold' }}>Score</td>
                {[10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => {
                  const record = holes.find((r) => r.holeNumber === h)
                  if (!record) return <td key={h} style={{ padding: '6px' }}>-</td>
                  const diff = record.scoreDiff
                  return (
                    <td key={h} style={{ padding: '6px', fontWeight: 'bold', color: diff <= 0 ? '#15803d' : '#b91c1c' }}>
                      {diff === 0 ? '0' : diff > 0 ? `+${diff}` : diff}
                    </td>
                  )
                })}
                <td style={{ padding: '6px', fontWeight: 'bold', backgroundColor: '#dcfce7' }}>
                  {holes.filter((r) => r.holeNumber > 9).reduce((acc, r) => acc + r.score, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. 닫기 버튼 */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          ← 닫기 (목록으로 돌아가기)
        </button>
      )}

      {/* ======================================================== */}
      {/* 🌟 대량 데이터 탐색용 라운드 선택 모달 */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '16px',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff', borderRadius: '16px', maxWidth: '560px',
              width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', overflow: 'hidden',
            }}
            onClick={(e: any) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                  {compareMode === 'my' ? '👤 내 과거 라운드 직접 선택' : `🏌️ ${availableFriends.find((f) => f.id === selectedFriendId)?.name || '친구'}의 라운드 직접 선택`}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                  {effectiveCcName}에서 기록된 총 {modalTargetRounds.length}개의 라운드
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '12px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => setModalSortOrder('latest')}
                  style={{
                    padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px',
                    border: modalSortOrder === 'latest' ? '1px solid #0f172a' : '1px solid #cbd5e1',
                    backgroundColor: modalSortOrder === 'latest' ? '#0f172a' : '#ffffff',
                    color: modalSortOrder === 'latest' ? '#ffffff' : '#475569',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  최신순
                </button>
                <button
                  onClick={() => setModalSortOrder('lowestScore')}
                  style={{
                    padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px',
                    border: modalSortOrder === 'lowestScore' ? '1px solid #0f172a' : '1px solid #cbd5e1',
                    backgroundColor: modalSortOrder === 'lowestScore' ? '#0f172a' : '#ffffff',
                    color: modalSortOrder === 'lowestScore' ? '#ffffff' : '#475569',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  스코어 낮은순 (라베)
                </button>
              </div>

              <input
                type="text"
                placeholder="날짜 검색 (예: 2024.08)"
                value={modalSearchText}
                onChange={(e: any) => setModalSearchText(e.target.value)}
                style={{
                  flex: 1, minWidth: '130px', padding: '6px 10px',
                  borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none',
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {modalTargetRounds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '13px' }}>
                  조건에 일치하는 라운드 기록이 없습니다.
                </div>
              ) : (
                modalTargetRounds.map((rnd) => {
                  const isSelected = selectedQuickFilter === 'custom' && selectedRoundId === rnd.id
                  const isBest = (compareMode === 'my' && rnd.id === myBestRoundId) || (compareMode === 'friend' && rnd.id === friendBestRoundId)
                  const scoreDiffWithCurrent = totalScore - rnd.totalScore

                  return (
                    <div
                      key={rnd.id}
                      onClick={() => {
                        setSelectedQuickFilter('custom')
                        setSelectedRoundId(rnd.id)
                        setIsModalOpen(false)
                      }}
                      style={{
                        padding: '12px 14px', borderRadius: '10px',
                        border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer', transition: 'border 0.2s, background-color 0.2s',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
                            📅 {rnd.date}
                          </span>
                          {isBest && (
                            <span style={{ fontSize: '10px', backgroundColor: '#fef3c7', color: '#d97706', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                              🏆 라베
                            </span>
                          )}
                          {rnd.ownerName && compareMode === 'friend' && (
                            <span style={{ fontSize: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                              {rnd.ownerName}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px', color: '#64748b' }}>
                          <span>FW: <strong style={{ color: '#059669' }}>{rnd.fwPercent}%</strong></span>
                          <span>GIR: <strong style={{ color: '#d97706' }}>{rnd.girPercent}%</strong></span>
                          <span>퍼팅: <strong style={{ color: '#0284c7' }}>{rnd.totalPutts}개</strong></span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>
                          {rnd.totalScore}타
                          <span style={{ fontSize: '12px', color: rnd.scoreDiff <= 0 ? '#15803d' : '#b91c1c', marginLeft: '4px' }}>
                            ({rnd.scoreDiff >= 0 ? `+${rnd.scoreDiff}` : rnd.scoreDiff})
                          </span>
                        </div>
                        <div style={{ fontSize: '10.5px', color: scoreDiffWithCurrent > 0 ? '#dc2626' : '#16a34a', fontWeight: 600, marginTop: '2px' }}>
                          내 기록 대비 {scoreDiffWithCurrent > 0 ? `+${scoreDiffWithCurrent}타 열세` : scoreDiffWithCurrent === 0 ? '동타' : `${Math.abs(scoreDiffWithCurrent)}타 우세`}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', textAlign: 'right' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '8px 16px', backgroundColor: '#64748b', color: '#ffffff',
                  border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: 'bold', cursor: 'pointer',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}