'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import RoundReport, { SavedRoundData } from '../score/RoundReport'
import { ClubItem } from '@/types/golf'

export interface UserProfile {
  nickname: string
  email: string
  handicap: number
  bestScore: number
  experienceYears: number
  region: string
  favoriteCourse: string
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

// 💬 댓글 데이터 구조
export interface BoardComment {
  id: string
  author: string
  isAdmin?: boolean
  content: string
  date: string
}

// 📋 게시판 게시글 데이터 구조
export interface BoardPost {
  id: string
  title: string
  content: string
  category: 'suggestion' | 'bug' | 'course' | 'general'
  author: string
  authorEmail?: string
  date: string
  images: string[] // Base64
  likes: number
  isSecret?: boolean // 🔒 비밀글 여부
  comments: BoardComment[]
}

const DEFAULT_PROFILE: UserProfile = {
  nickname: '싱글을향해',
  email: 'golfer@platform.com',
  handicap: 14,
  bestScore: 82,
  experienceYears: 3,
  region: '부산 / 경남',
  favoriteCourse: '동래베네스트CC',
}

// 운영자 권한은 추후 서버(DB의 role)에서 판단합니다.

type AnalysisTab = 'score' | 'driver' | 'club' | 'gir' | 'shortgame' | 'putting'
type CompareTargetMode = 'benchmark' | 'friend'

interface OverallBenchmarkStats {
  roundCount: number
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
  clubStats: Record<string, { avgDist: number; count: number; approachRate: number }>
}

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

const DEFAULT_BENCHMARK_OVERALL: OverallBenchmarkStats = {
  roundCount: 100,
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
  clubStats: Object.keys(DEFAULT_CLUB_DISTANCES).reduce((acc, name) => {
    acc[name] = {
      avgDist: DEFAULT_CLUB_DISTANCES[name],
      count: 10,
      approachRate: DEFAULT_CLUB_APPROACH[name] || 75,
    }
    return acc
  }, {} as Record<string, { avgDist: number; count: number; approachRate: number }>),
}

function calculateOverallStats(rounds: SavedRoundData[], fallbackScore: number = 82): OverallBenchmarkStats {
  if (!rounds || rounds.length === 0) {
    return {
      ...DEFAULT_BENCHMARK_OVERALL,
      roundCount: 0,
      score: fallbackScore,
    }
  }

  const roundCount = rounds.length
  let totalScoreSum = 0
  let totalPuttsSum = 0
  let totalFwRateSum = 0
  let totalGirRateSum = 0

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

  let maxDriverDist = 0
  let driverDistSum = 0
  let driverCount = 0

  const clubDistMap: Record<string, { totalDist: number; count: number }> = {}
  const clubAppMap: Record<string, { totalRate: number; count: number }> = {}

  rounds.forEach((rnd) => {
    totalScoreSum += rnd.totalScore
    totalPuttsSum += rnd.totalPutts || 36
    totalFwRateSum += rnd.fwPercent || 50
    totalGirRateSum += rnd.girPercent || 30

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

      shots.forEach((s) => {
        if ((s.shotDistance || 0) > 0) {
          if (!clubDistMap[s.club]) clubDistMap[s.club] = { totalDist: 0, count: 0 }
          clubDistMap[s.club].totalDist += s.shotDistance
          clubDistMap[s.club].count += 1

          if (s.club === '드라이버' && s.shotNumber === 1) {
            if (s.shotDistance > maxDriverDist) maxDriverDist = s.shotDistance
            driverDistSum += s.shotDistance
            driverCount++
          }
        }

        const expDist = DEFAULT_CLUB_DISTANCES[s.club] || 130
        const isApp = s.distanceToPinBefore > 0 &&
          (s.club === '퍼터'
            ? s.ballLie === '그린' || s.ballLie === '홀아웃' || s.distanceToPinBefore <= 30
            : s.distanceToPinBefore <= expDist + 20)

        if (isApp) {
          if (!clubAppMap[s.club]) clubAppMap[s.club] = { totalRate: 0, count: 0 }
          const rate = Math.max(0, (1 - s.distanceToPinAfter / s.distanceToPinBefore) * 100)
          clubAppMap[s.club].totalRate += rate
          clubAppMap[s.club].count += 1
        }
      })
    })
  })

  const hTot = allHolesCount || (roundCount * 18)
  const avgScore = Number((totalScoreSum / roundCount).toFixed(1))
  const avgPar3 = par3Scores.length > 0 ? Number((par3Scores.reduce((a, b) => a + b, 0) / par3Scores.length).toFixed(2)) : 3.4
  const avgPar4 = par4Scores.length > 0 ? Number((par4Scores.reduce((a, b) => a + b, 0) / par4Scores.length).toFixed(2)) : 4.5
  const avgPar5 = par5Scores.length > 0 ? Number((par5Scores.reduce((a, b) => a + b, 0) / par5Scores.length).toFixed(2)) : 5.4

  const finalClubStats: Record<string, { avgDist: number; count: number; approachRate: number }> = {}
  let appRateTotal = 0
  let appClubCount = 0

  DEFAULT_REPORT_CLUBS.forEach((c) => {
    const dStat = clubDistMap[c.name]
    const aStat = clubAppMap[c.name]
    const avgDist = dStat && dStat.count > 0 ? Math.round(dStat.totalDist / dStat.count) : (DEFAULT_CLUB_DISTANCES[c.name] || 130)
    const appRate = aStat && aStat.count > 0 ? Math.round(aStat.totalRate / aStat.count) : (DEFAULT_CLUB_APPROACH[c.name] || 75)

    if (aStat && aStat.count > 0) {
      appRateTotal += appRate
      appClubCount++
    }

    finalClubStats[c.name] = {
      avgDist,
      count: dStat ? dStat.count : 0,
      approachRate: appRate,
    }
  })

  const overallAvgApproach = appClubCount > 0 ? Math.round(appRateTotal / appClubCount) : 76

  return {
    roundCount,
    score: avgScore,
    par3: avgPar3,
    par4: avgPar4,
    par5: avgPar5,
    birdieRate: Number(((birdieCount / (allHolesCount || 1)) * 100).toFixed(1)),
    parRate: Number(((parCount / (allHolesCount || 1)) * 100).toFixed(1)),
    bogeyRate: Number(((bogeyCount / (allHolesCount || 1)) * 100).toFixed(1)),
    doubleRate: Number(((doubleCount / (allHolesCount || 1)) * 100).toFixed(1)),
    penaltyRate: Number(((penalties / (allHolesCount || 1)) * 10).toFixed(1)),
    driverMax: maxDriverDist > 0 ? maxDriverDist : 225,
    driverAvg: driverCount > 0 ? Math.round(driverDistSum / driverCount) : 195,
    fwRate: Math.round(totalFwRateSum / roundCount),
    girRate: Math.round(totalGirRateSum / roundCount),
    fwGirRate: 46.5,
    roughGirRate: 26.0,
    bunkerGirRate: 14.5,
    approachRate: overallAvgApproach,
    scrambleRate: nonGirCount > 0 ? Math.round((scrambleSuccess / nonGirCount) * 100) : 38,
    bunkerSaveRate: bunkerHolesCount > 0 ? Math.round((bunkerSuccess / bunkerHolesCount) * 100) : 22,
    avgPutts: Number((totalPuttsSum / hTot).toFixed(2)),
    girPutts: girHolesCount > 0 ? Number((girPuttsSum / girHolesCount).toFixed(2)) : 2.05,
    totalPutts: Number((totalPuttsSum / roundCount).toFixed(1)),
    onePutt: Number((onePutts / roundCount).toFixed(1)),
    twoPutt: Number((twoPutts / roundCount).toFixed(1)),
    threePutt: Number((threePutts / roundCount).toFixed(1)),
    clubStats: finalClubStats,
  }
}

export default function MyTab() {
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'benchmark'>('history')
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false)
  const [editForm, setEditForm] = useState<UserProfile>(DEFAULT_PROFILE)

  // ----------------------------------------------------
  // 📢 [소통 & 제안 게시판] 상태 관리
  // ----------------------------------------------------
  const [posts, setPosts] = useState<BoardPost[]>([])
  const [boardCategoryFilter, setBoardCategoryFilter] = useState<'all' | 'suggestion' | 'bug' | 'course' | 'general'>('all')
  const [isWriteModalOpen, setIsWriteModalOpen] = useState<boolean>(false)
  const [selectedPostDetail, setSelectedPostDetail] = useState<BoardPost | null>(null)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false)
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('')
  const [isAdminLoginPromptOpen, setIsAdminLoginPromptOpen] = useState<boolean>(false)

  // 글쓰기 폼
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [newPostForm, setNewPostForm] = useState<{
    title: string
    content: string
    category: 'suggestion' | 'bug' | 'course' | 'general'
    isSecret: boolean
    images: string[]
  }>({
    title: '',
    content: '',
    category: 'suggestion',
    isSecret: false,
    images: [],
  })

  // 댓글 입력 상태
  const [commentInput, setCommentInput] = useState<string>('')

  // 저장된 라운드 목록 및 상세 열람 상태
  const [rounds, setRounds] = useState<SavedRoundData[]>([])
  const [selectedRoundDetail, setSelectedRoundDetail] = useState<SavedRoundData | null>(null)

  // [다른 골퍼와 비교] 상태
  const [compareAnalysisTab, setCompareAnalysisTab] = useState<AnalysisTab>('score')
  const [compareTargetMode, setCompareTargetMode] = useState<CompareTargetMode>('benchmark')
  const [selectedFriendId, setSelectedFriendId] = useState<string>('')

  const [clubMetricMode, setClubMetricMode] = useState<'both' | 'distance' | 'approach'>('both')
  const [clubCategoryFilter, setClubCategoryFilter] = useState<'all' | 'wood' | 'iron' | 'wedge'>('all')

  // 초기 데이터 로드
  useEffect(() => {
    if (typeof window === 'undefined') return
    const user = localStorage.getItem('golf_user') || 'guest'

    // 프로필 로드
    const savedProfileStr = localStorage.getItem(`golf_profile_${user}`)
    if (savedProfileStr) {
      try {
        const p = JSON.parse(savedProfileStr)
        setProfile(p)
        setEditForm(p)
      } catch (e) {
        console.error('Failed to parse user profile:', e)
      }
    } else {
      setProfile((prev) => ({ ...prev, email: user }))
      setEditForm((prev) => ({ ...prev, email: user }))
    }

    // 라운드 히스토리 로드
    const storageKey = `golf_rounds_${user}`
    const roundsStr = localStorage.getItem(storageKey)
    if (roundsStr) {
      try {
        setRounds(JSON.parse(roundsStr))
      } catch (e) {
        console.error('Failed to parse round history:', e)
      }
    }

    // 게시판 게시글 로드 (초기 웰컴 글 포함)
    const storedPosts = localStorage.getItem('golf_board_posts')
    if (storedPosts) {
      try {
        setPosts(JSON.parse(storedPosts))
      } catch (_) {}
    } else {
      const initialPosts: BoardPost[] = [
        {
          id: 'post_sample_1',
          title: '⛳ 골프장 코스별 그린 스피드 입력 기능이 있으면 좋겠어요!',
          content: '라운드 시작할 때 당일 그린 스피드(2.6, 2.8 등)를 입력해두면 퍼팅 거리 분석할 때 훨씬 유용할 것 같습니다.',
          category: 'suggestion',
          author: '버디장인',
          date: '2024.10.05',
          images: [],
          likes: 4,
          isSecret: false,
          comments: [
            {
              id: 'c_1',
              author: '골프비서 운영팀',
              isAdmin: true,
              content: '소중한 의견 감사드립니다! 차기 스코어카드 업데이트 시 코스 환경 설정 항목에 반영 검토하겠습니다. 🏌️',
              date: '2024.10.06 10:15',
            },
            {
              id: 'c_2',
              author: '싱글을향해',
              isAdmin: false,
              content: '저도 이 기능 적극 찬성합니다!',
              date: '2024.10.06 12:40',
            },
          ],
        },
        {
          id: 'post_sample_2',
          title: '클럽별 분석에서 웨지 52도, 56도 비거리 정확도 너무 만족스럽습니다',
          content: '라운드 끝나고 클럽별 핀 접근율 보면서 웨지 연습 방향을 잡을 수 있어서 실력 향상에 큰 도움이 되고 있습니다.',
          category: 'general',
          author: '파세이브',
          date: '2024.10.02',
          images: [],
          likes: 2,
          isSecret: false,
          comments: [],
        },
      ]
      setPosts(initialPosts)
      localStorage.setItem('golf_board_posts', JSON.stringify(initialPosts))
    }
  }, [])

  // 프로필 저장
  const handleSaveProfile = () => {
    setProfile(editForm)
    const user = localStorage.getItem('golf_user') || 'guest'
    localStorage.setItem(`golf_profile_${user}`, JSON.stringify(editForm))
    setIsEditModalOpen(false)
  }

  // 게시글 사진 첨부
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const availableSlots = 3 - newPostForm.images.length
    if (availableSlots <= 0) {
      alert('사진은 최대 3장까지 첨부할 수 있습니다.')
      return
    }

    const filesToRead = Array.from(files).slice(0, availableSlots)
    filesToRead.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 첨부할 수 있습니다.')
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        const res = ev.target?.result as string
        if (res) {
          setNewPostForm((prev) => ({
            ...prev,
            images: [...prev.images, res],
          }))
        }
      }
      reader.readAsDataURL(file)
    })
    if (e.target) e.target.value = ''
  }

  // 게시글 등록
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPostForm.title.trim() || !newPostForm.content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.')
      return
    }

    const newPost: BoardPost = {
      id: `post_${Date.now()}`,
      title: newPostForm.title.trim(),
      content: newPostForm.content.trim(),
      category: newPostForm.category,
      author: profile.nickname || '골퍼',
      authorEmail: profile.email,
      date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      images: newPostForm.images,
      likes: 0,
      isSecret: newPostForm.isSecret,
      comments: [],
    }

    const updated = [newPost, ...posts]
    setPosts(updated)
    localStorage.setItem('golf_board_posts', JSON.stringify(updated))

    setIsWriteModalOpen(false)
    setNewPostForm({
      title: '',
      content: '',
      category: 'suggestion',
      isSecret: false,
      images: [],
    })
    alert('소중한 글이 등록되었습니다!')
  }

  // 공감(좋아요) 토글
  const handleLikePost = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = posts.map((p) => (p.id === postId ? { ...p, likes: p.likes + 1 } : p))
    setPosts(updated)
    localStorage.setItem('golf_board_posts', JSON.stringify(updated))
    if (selectedPostDetail && selectedPostDetail.id === postId) {
      setSelectedPostDetail({ ...selectedPostDetail, likes: selectedPostDetail.likes + 1 })
    }
  }

  // 댓글 작성
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPostDetail || !commentInput.trim()) return

    const newComment: BoardComment = {
      id: `cmt_${Date.now()}`,
      author: isAdminAuthenticated ? '골프비서 운영팀' : (profile.nickname || '골퍼'),
      isAdmin: isAdminAuthenticated,
      content: commentInput.trim(),
      date: new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    }

    const updatedPosts = posts.map((p) => {
      if (p.id === selectedPostDetail.id) {
        return {
          ...p,
          comments: [...p.comments, newComment],
        }
      }
      return p
    })

    setPosts(updatedPosts)
    localStorage.setItem('golf_board_posts', JSON.stringify(updatedPosts))
    setSelectedPostDetail({
      ...selectedPostDetail,
      comments: [...selectedPostDetail.comments, newComment],
    })
    setCommentInput('')
  }

    // 운영자 인증 (임시 비활성화: 추후 서버 권한으로 대체)
  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault()
    alert('운영자 기능은 준비 중입니다.')
    setIsAdminLoginPromptOpen(false)
    setAdminPasswordInput('')
  }

  // 게시글 삭제
  const handleDeletePost = (postId: string) => {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return
    const updated = posts.filter((p) => p.id !== postId)
    setPosts(updated)
    localStorage.setItem('golf_board_posts', JSON.stringify(updated))
    if (selectedPostDetail?.id === postId) {
      setSelectedPostDetail(null)
    }
  }

  // 누적 통계 계산
  const totalRoundsCount = rounds.length
  const avgScore = totalRoundsCount > 0
    ? Math.round(rounds.reduce((acc, r) => acc + r.totalScore, 0) / totalRoundsCount)
    : profile.bestScore + 6

  const bestScoreRecorded = totalRoundsCount > 0
    ? Math.min(...rounds.map((r) => r.totalScore), profile.bestScore)
    : profile.bestScore

  const avgGIR = totalRoundsCount > 0
    ? Math.round(rounds.reduce((acc, r) => acc + r.girPercent, 0) / totalRoundsCount)
    : 34

  const avgFW = totalRoundsCount > 0
    ? Math.round(rounds.reduce((acc, r) => acc + r.fwPercent, 0) / totalRoundsCount)
    : 52

  const avgPutts = totalRoundsCount > 0
    ? Number((rounds.reduce((acc, r) => acc + r.totalPutts, 0) / totalRoundsCount).toFixed(1))
    : 34.2

  const puttsPerHole = (avgPutts / 18).toFixed(1)

  const rankPercentile =
    avgScore <= 79 ? '상위 3%' :
    avgScore <= 84 ? '상위 12%' :
    avgScore <= 89 ? '상위 25%' :
    avgScore <= 95 ? '상위 48%' : '상위 65%'

  // 비교 데이터 계산
  const myOverallStats = useMemo<OverallBenchmarkStats>(() => {
    return calculateOverallStats(rounds, avgScore)
  }, [rounds, avgScore])

  const friendsList = useMemo<FriendUser[]>(() => [
    { id: 'fr_kim', name: '김민수', handicap: 10 },
    { id: 'fr_lee', name: '이지은 Pro', handicap: 4 },
    { id: 'fr_park', name: '박준형', handicap: 18 },
  ], [])

  const friendsRoundData = useMemo<FriendRoundData[]>(() => [
    { id: 'fr_1_1', userId: 'fr_kim', userName: '김민수', date: '2024.09.12', totalScore: 80, totalPar: 72, scoreDiff: 8, girPercent: 44, fwPercent: 64, totalPutts: 32, holes: [] },
    { id: 'fr_1_2', userId: 'fr_kim', userName: '김민수', date: '2024.08.10', totalScore: 82, totalPar: 72, scoreDiff: 10, girPercent: 39, fwPercent: 57, totalPutts: 33, holes: [] },
    { id: 'fr_2_1', userId: 'fr_lee', userName: '이지은 Pro', date: '2024.09.28', totalScore: 76, totalPar: 72, scoreDiff: 4, girPercent: 55, fwPercent: 71, totalPutts: 30, holes: [] },
    { id: 'fr_3_1', userId: 'fr_park', userName: '박준형', date: '2024.08.30', totalScore: 91, totalPar: 72, scoreDiff: 19, girPercent: 22, fwPercent: 35, totalPutts: 38, holes: [] },
  ], [])

  useEffect(() => {
    if (compareTargetMode === 'friend' && !selectedFriendId && friendsList.length > 0) {
      setSelectedFriendId(friendsList[0].id)
    }
  }, [compareTargetMode, selectedFriendId, friendsList])

  const selectedFriendOverallStats = useMemo<OverallBenchmarkStats>(() => {
    if (!selectedFriendId) return DEFAULT_BENCHMARK_OVERALL
    const friendRounds = friendsRoundData.filter((r) => r.userId === selectedFriendId)
    return calculateOverallStats(friendRounds, 82)
  }, [selectedFriendId, friendsRoundData])

  const activeComparison = useMemo<{
    stats: OverallBenchmarkStats
    label: string
    subLabel: string
    badgeColor: string
    isFriend: boolean
  }>(() => {
    if (compareTargetMode === 'benchmark') {
      return {
        stats: DEFAULT_BENCHMARK_OVERALL,
        label: '동급 핸디 골퍼(80~90타대) 평균',
        subLabel: `유사 그룹 전체 평균 (${DEFAULT_BENCHMARK_OVERALL.score}타)`,
        badgeColor: '#64748b',
        isFriend: false,
      }
    }

    const friendObj = friendsList.find((f) => f.id === selectedFriendId)
    const friendName = friendObj ? friendObj.name : '친구'

    return {
      stats: selectedFriendOverallStats,
      label: `${friendName}님의 전체 누적 평균`,
      subLabel: `총 ${selectedFriendOverallStats.roundCount}회 라운드 누적 평균 (${selectedFriendOverallStats.score}타)`,
      badgeColor: '#2563eb',
      isFriend: true,
    }
  }, [compareTargetMode, selectedFriendId, friendsList, selectedFriendOverallStats])

  const targetStats = activeComparison.stats

  const renderCompareBadge = (myVal: number, avgVal: number, lowerIsBetter: boolean = false) => {
    if (!avgVal || avgVal === 0) {
      return <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', color: '#64748b', backgroundColor: '#f1f5f9' }}>- 대등</span>
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

    if (isBigAdvantage) return <span style={{ ...baseStyle, color: '#dc2626', backgroundColor: '#fee2e2' }}>↑ {diffRate}% 우세</span>
    if (isAdvantage) return <span style={{ ...baseStyle, color: '#ea580c', backgroundColor: '#ffedd5' }}>↑ {diffRate}% 우세</span>
    if (isBigDisadvantage) return <span style={{ ...baseStyle, color: '#2563eb', backgroundColor: '#dbeafe' }}>↓ {diffRate}% 열세</span>
    if (isDisadvantage) return <span style={{ ...baseStyle, color: '#0284c7', backgroundColor: '#e0f2fe' }}>↓ {diffRate}% 열세</span>
    return <span style={{ ...baseStyle, color: '#64748b', backgroundColor: '#f1f5f9' }}>- 대등</span>
  }

  const renderDualBar = (label: string, myVal: number, avgVal: number, maxRange: number, unit: string = '', lowerIsBetter: boolean = false) => {
    const myPct = myVal <= 0 ? 0 : Math.min(100, Math.max(2, (myVal / maxRange) * 100))
    const avgPct = avgVal <= 0 ? 0 : Math.min(100, Math.max(2, (avgVal / maxRange) * 100))

    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '4px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#1e293b' }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {renderCompareBadge(myVal, avgVal, lowerIsBetter)}
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#15803d' }}>{myVal}{unit}</span>
            <span style={{ fontSize: '10.5px', color: '#64748b' }}>({activeComparison.isFriend ? '친구' : '평균'} {avgVal}{unit})</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ width: '42px', fontSize: '11px', color: '#15803d', fontWeight: 600 }}>내 평균</span>
          <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
            <div style={{ width: `${myPct}%`, backgroundColor: '#16a34a', height: '100%', borderRadius: '7px', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '42px', fontSize: '11px', color: activeComparison.isFriend ? '#2563eb' : '#64748b', fontWeight: 600 }}>
            {activeComparison.isFriend ? '친구' : '동급평균'}
          </span>
          <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
            <div style={{ width: `${avgPct}%`, backgroundColor: activeComparison.isFriend ? '#3b82f6' : '#64748b', height: '100%', borderRadius: '7px', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>
    )
  }

  const COMPARE_TABS: { id: AnalysisTab; label: string; icon: string }[] = [
    { id: 'score', label: '스코어 분석', icon: '🎯' },
    { id: 'driver', label: '드라이버 분석', icon: '🏌️' },
    { id: 'club', label: '클럽별 분석', icon: '📊' },
    { id: 'gir', label: '그린적중 분석', icon: '⛳' },
    { id: 'shortgame', label: '숏게임 분석', icon: '🏖️' },
    { id: 'putting', label: '퍼팅 분석', icon: '🕳️' },
  ]

  const scoreGap = (myOverallStats.score - targetStats.score).toFixed(1)

  // 게시판 필터링된 글 목록
  const filteredPosts = posts.filter((p) => {
    if (boardCategoryFilter === 'all') return true
    return p.category === boardCategoryFilter
  })

  return (
    <div style={{ padding: '16px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 1. 프로필 상단 요약 배너 */}
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '20px 22px',
          marginBottom: '16px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                border: '2px solid #34d399',
                flexShrink: 0,
              }}
            >
              🏌️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 'bold' }}>{profile.nickname}</h2>
                <span style={{ fontSize: '11.5px', backgroundColor: '#334155', padding: '2px 8px', borderRadius: '12px', color: '#38bdf8' }}>
                  구력 {profile.experienceYears}년차
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
                지역: {profile.region} · 선호: {profile.favoriteCourse}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setEditForm(profile)
              setIsEditModalOpen(true)
            }}
            style={{
              padding: '8px 14px',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #475569',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✏️ 내 정보 수정
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #1e293b',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>라이프 베스트 (라베)</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4ade80' }}>{bestScoreRecorded}타</div>
          </div>
          <div style={{ borderLeft: '1px solid #334155', borderRight: '1px solid #334155' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>평균 스코어</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>{avgScore}타</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>전체 랭킹 백분위</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>{rankPercentile}</div>
          </div>
        </div>
      </div>

      {/* 2. 내 데이터 대시보드 영역 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '12px 4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>기록 라운드</div>
            <div style={{ fontSize: '19px', fontWeight: 'bold', color: '#0f172a', margin: '3px 0' }}>{totalRoundsCount}회</div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>총 {totalRoundsCount * 18}홀</div>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '12px 4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>FW 안착률</div>
            <div style={{ fontSize: '19px', fontWeight: 'bold', color: '#047857', margin: '3px 0' }}>{avgFW}%</div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>티샷 안정</div>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '12px 4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>GIR 적중률</div>
            <div style={{ fontSize: '19px', fontWeight: 'bold', color: '#d97706', margin: '3px 0' }}>{avgGIR}%</div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>온그린율</div>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '12px 4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>평균 퍼트 수</div>
            <div style={{ fontSize: '19px', fontWeight: 'bold', color: '#2563eb', margin: '3px 0' }}>{avgPutts}개</div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>홀당 {puttsPerHole}개</div>
          </div>
        </div>

        {/* AI 맞춤 진단 배너 */}
        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#1e40af' }}>
              💡 AI 맞춤 데이터 진단 리포트
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#3b82f6', lineHeight: '1.4' }}>
              "페어웨이 안착률({avgFW}%)은 우수하지만, 그린 적중률({avgGIR}%)을 40% 이상으로 끌어올리면 <strong>라베 {bestScoreRecorded - 4}타 경신</strong>이 유력합니다. 100m 이내 숏아이언 정확도 레슨을 추천합니다."
            </p>
          </div>
          <button
            onClick={() => alert('레슨 탭으로 이동하여 맞춤 아이언 레슨 프로를 확인하세요!')}
            style={{
              padding: '8px 14px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            👨‍🏫 추천 레슨 프로 보기
          </button>
        </div>
      </div>

      {/* 3. 서브 탭 네비게이션 버튼군 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        <button
          onClick={() => setActiveSubTab('history')}
          style={{
            padding: '11px',
            borderRadius: '10px',
            border: activeSubTab === 'history' ? '2px solid #047857' : '1px solid #cbd5e1',
            backgroundColor: activeSubTab === 'history' ? '#ecfdf5' : '#ffffff',
            color: activeSubTab === 'history' ? '#047857' : '#475569',
            fontWeight: 'bold',
            fontSize: '13.5px',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          📂 라운드 히스토리 ({totalRoundsCount})
        </button>

        <button
          onClick={() => setActiveSubTab('benchmark')}
          style={{
            padding: '11px',
            borderRadius: '10px',
            border: activeSubTab === 'benchmark' ? '2px solid #047857' : '1px solid #cbd5e1',
            backgroundColor: activeSubTab === 'benchmark' ? '#ecfdf5' : '#ffffff',
            color: activeSubTab === 'benchmark' ? '#047857' : '#475569',
            fontWeight: 'bold',
            fontSize: '13.5px',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          👥 다른 골퍼와 비교
        </button>
      </div>

      {/* 4-A. [서브탭 1] 라운드 히스토리 목록 */}
      {activeSubTab === 'history' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '6px' }}>
            <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 'bold', color: '#1e293b' }}>
              전체 라운드 기록 ({rounds.length}개)
            </h3>
            <span style={{ fontSize: '11.5px', color: '#047857', fontWeight: 600 }}>
              터치 시 6대 영역별 상세 분석 리포트 열람
            </span>
          </div>

          {rounds.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              아직 저장된 라운드 기록이 없습니다.<br />필드에서 스코어 탭을 통해 18홀을 기록하고 라운드를 완료해보세요!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rounds.map((r, idx) => (
                <div
                  key={r.id || idx}
                  onClick={() => setSelectedRoundDetail(r)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '13px 15px',
                    backgroundColor: idx === 0 ? '#f0fdf4' : '#f8fafc',
                    borderRadius: '10px',
                    border: idx === 0 ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{r.date}</span>
                      {idx === 0 && <span style={{ fontSize: '10.5px', backgroundColor: '#047857', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>최근</span>}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                      GIR: {r.girPercent}% · FW안착률: {r.fwPercent}% · 퍼팅: {r.totalPutts}개
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '19px', fontWeight: 'bold', color: '#0f172a' }}>
                      {r.totalScore}타
                    </div>
                    <div style={{ fontSize: '11.5px', color: r.scoreDiff <= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {r.scoreDiff === 0 ? 'E' : r.scoreDiff > 0 ? `+${r.scoreDiff}` : r.scoreDiff}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4-B. [서브탭 2] 다른 골퍼와 비교 (누적 평균 기반 6대 분석 & 친구 선택) */}
      {activeSubTab === 'benchmark' && (
        <div>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                👥 비교 대상 골퍼 선택
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                전체 라운딩 누적 평균 기준
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: compareTargetMode === 'friend' ? '12px' : '4px' }}>
              <button
                onClick={() => setCompareTargetMode('benchmark')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: compareTargetMode === 'benchmark' ? '2px solid #0f172a' : '1px solid #cbd5e1',
                  backgroundColor: compareTargetMode === 'benchmark' ? '#0f172a' : '#f8fafc',
                  color: compareTargetMode === 'benchmark' ? '#ffffff' : '#475569',
                  fontSize: '12.5px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                🎯 동급 핸디 골퍼 평균
              </button>

              <button
                onClick={() => setCompareTargetMode('friend')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: compareTargetMode === 'friend' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: compareTargetMode === 'friend' ? '#2563eb' : '#f8fafc',
                  color: compareTargetMode === 'friend' ? '#ffffff' : '#475569',
                  fontSize: '12.5px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                👥 친구와 1:1 비교 ({friendsList.length}명)
              </button>
            </div>

            {compareTargetMode === 'friend' && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                  비교할 친구를 선택하세요:
                </div>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {friendsList.map((fr) => {
                    const isSel = selectedFriendId === fr.id
                    const rCount = friendsRoundData.filter((r) => r.userId === fr.id).length
                    return (
                      <button
                        key={fr.id}
                        onClick={() => setSelectedFriendId(fr.id)}
                        style={{
                          flex: '0 0 auto',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          border: isSel ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: isSel ? '#eff6ff' : '#ffffff',
                          color: isSel ? '#1d4ed8' : '#334155',
                          fontSize: '12px',
                          fontWeight: isSel ? 'bold' : 'normal',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>👤 {fr.name}</span>
                        <span style={{ fontSize: '10.5px', color: isSel ? '#2563eb' : '#94a3b8' }}>
                          {rCount}회 평균
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                backgroundColor: compareTargetMode === 'friend' ? '#eff6ff' : '#f8fafc',
                borderRadius: '8px',
                border: `1px solid ${compareTargetMode === 'friend' ? '#bfdbfe' : '#e2e8f0'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: activeComparison.badgeColor, fontWeight: 'bold', marginRight: '6px' }}>● 비교 기준:</span>
                <strong style={{ color: '#0f172a' }}>{activeComparison.label}</strong>
                <span style={{ color: '#64748b', marginLeft: '4px' }}>({activeComparison.subLabel})</span>
              </div>
              {compareTargetMode === 'friend' && (
                <button
                  onClick={() => setCompareTargetMode('benchmark')}
                  style={{ fontSize: '11px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  기본 평균으로 ✕
                </button>
              )}
            </div>
          </div>

          {/* 누적 평균 대형 요약 카드 */}
          <div style={{ backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '16px', padding: '20px 22px', marginBottom: '16px', boxShadow: '0 8px 20px -4px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>{profile.nickname} 골퍼의 전체 라운딩 누적 평균</div>
                <h1 style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 'bold', color: '#ffffff' }}>
                  전체 평균 {myOverallStats.score}타
                  <span style={{ fontSize: '15px', color: '#94a3b8', marginLeft: '8px', fontWeight: 'normal' }}>(기준 PAR 72)</span>
                </h1>
              </div>
              <div style={{ textAlign: 'right', fontSize: '12px', color: '#94a3b8' }}>
                <div>비교 대상: {targetStats.score}타</div>
                <div style={{ marginTop: '3px', fontSize: '12px', fontWeight: 'bold', color: Number(scoreGap) <= 0 ? '#4ade80' : '#f87171' }}>
                  {Number(scoreGap) < 0 ? `${Math.abs(Number(scoreGap))}타 우세` : Number(scoreGap) > 0 ? `+${scoreGap}타 열세` : '동타'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '10px 2px', borderRadius: '8px' }}>
                <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>평균 FW 안착</div>
                <div style={{ fontSize: '16.5px', fontWeight: 'bold', color: '#34d399', marginTop: '3px' }}>{myOverallStats.fwRate}%</div>
                <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>비교 {targetStats.fwRate}%</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '10px 2px', borderRadius: '8px' }}>
                <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>평균 GIR 적중</div>
                <div style={{ fontSize: '16.5px', fontWeight: 'bold', color: '#fbbf24', marginTop: '3px' }}>{myOverallStats.girRate}%</div>
                <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>비교 {targetStats.girRate}%</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '10px 2px', borderRadius: '8px' }}>
                <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>평균 퍼팅 수</div>
                <div style={{ fontSize: '16.5px', fontWeight: 'bold', color: '#38bdf8', marginTop: '3px' }}>{myOverallStats.totalPutts}개</div>
                <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>비교 {targetStats.totalPutts}개</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '10px 2px', borderRadius: '8px' }}>
                <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>평균 파 세이브</div>
                <div style={{ fontSize: '16.5px', fontWeight: 'bold', color: '#a78bfa', marginTop: '3px' }}>{myOverallStats.scrambleRate}%</div>
                <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>비교 {targetStats.scrambleRate}%</div>
              </div>
            </div>
          </div>

          {/* 6대 분석 네비게이션 탭 */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '14px', position: 'sticky', top: 0, backgroundColor: '#ffffff', zIndex: 10 }}>
            {COMPARE_TABS.map((tab) => {
              const isActive = compareAnalysisTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setCompareAnalysisTab(tab.id)}
                  style={{
                    flex: '1 0 auto',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: isActive ? '2px solid #047857' : '1px solid #cbd5e1',
                    backgroundColor: isActive ? '#047857' : '#ffffff',
                    color: isActive ? '#ffffff' : '#334155',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* 6대 탭별 상세 분석 데이터 카드 */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px', marginBottom: '20px' }}>
            {compareAnalysisTab === 'score' && (
              <div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>🎯 스코어 및 기준 PAR별 누적 평균 분석</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>{activeComparison.label} 대비 홀별 타수 득실 비교</p>
                </div>
                {renderDualBar('전체 평균 스코어 타수', myOverallStats.score, targetStats.score, 120, '타', true)}
                {renderDualBar('파3홀 평균 타수', myOverallStats.par3, targetStats.par3, 6, '타', true)}
                {renderDualBar('파4홀 평균 타수', myOverallStats.par4, targetStats.par4, 7, '타', true)}
                {renderDualBar('파5홀 평균 타수', myOverallStats.par5, targetStats.par5, 8, '타', true)}

                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px' }}>홀 단위 평균 기록 달성률 (%)</div>
                  {renderDualBar('버디 이하 기록 달성률', myOverallStats.birdieRate, targetStats.birdieRate, 50, '%', false)}
                  {renderDualBar('파(Par) 기록 달성률', myOverallStats.parRate, targetStats.parRate, 80, '%', false)}
                  {renderDualBar('보기 기록 달성률', myOverallStats.bogeyRate, targetStats.bogeyRate, 60, '%', true)}
                  {renderDualBar('더블보기 이상 발생률', myOverallStats.doubleRate, targetStats.doubleRate, 40, '%', true)}
                  {renderDualBar('벌타 발생 비율', myOverallStats.penaltyRate, targetStats.penaltyRate, 20, '%', true)}
                </div>
              </div>
            )}

            {compareAnalysisTab === 'driver' && (
              <div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>🏌️ 드라이버 티샷 비거리 및 안착률</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>티샷의 페어웨이 안착률 및 평균 비거리 누적 비교</p>
                </div>
                {renderDualBar('티샷 최대 비거리(롱기스트)', myOverallStats.driverMax, targetStats.driverMax, 320, 'm', false)}
                {renderDualBar('티샷 평균 비거리', myOverallStats.driverAvg, targetStats.driverAvg, 280, 'm', false)}
                {renderDualBar('페어웨이 안착률 (FW%)', myOverallStats.fwRate, targetStats.fwRate, 100, '%', false)}
                {renderDualBar('티샷 벌타율(OB/해저드)', myOverallStats.penaltyRate, targetStats.penaltyRate, 20, '%', true)}
              </div>
            )}

            {compareAnalysisTab === 'club' && (
              <div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>📊 클럽별 전체 평균 비거리 및 핀 접근율 분석</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>{activeComparison.label} 대비 클럽별 누적 평균 비거리와 정밀도 실시간 비교</p>
                </div>

                <div style={{ marginBottom: '18px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                  {renderDualBar('전체 핀 평균 접근율', myOverallStats.approachRate, targetStats.approachRate, 100, '%', false)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
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

                {(clubMetricMode === 'both' || clubMetricMode === 'distance') && (
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px' }}>📏 클럽별 전체 평균 비거리 비교 (m)</div>
                    {DEFAULT_REPORT_CLUBS
                      .filter((c) => {
                        if (clubCategoryFilter === 'wood') return c.category === 'wood' || c.category === 'driver' || c.category === 'utility'
                        if (clubCategoryFilter === 'iron') return c.category === 'iron'
                        if (clubCategoryFilter === 'wedge') return c.category === 'wedge'
                        return true
                      })
                      .map((c) => {
                        const myDist = myOverallStats.clubStats[c.name]?.avgDist || DEFAULT_CLUB_DISTANCES[c.name] || 130
                        const tDist = targetStats.clubStats[c.name]?.avgDist || DEFAULT_CLUB_DISTANCES[c.name] || 130
                        const maxScale = c.category === 'driver' ? 320 : c.category === 'wood' || c.category === 'utility' ? 260 : 220
                        return (
                          <div key={`dist_${c.id}`}>
                            {renderDualBar(`${c.name} 평균 비거리`, myDist, tDist, maxScale, 'm', false)}
                          </div>
                        )
                      })}
                  </div>
                )}

                {(clubMetricMode === 'both' || clubMetricMode === 'approach') && (
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px' }}>🎯 클럽별 핀 접근율 비교 (%)</div>
                    {DEFAULT_REPORT_CLUBS
                      .filter((c) => {
                        if (clubCategoryFilter === 'wood') return c.category === 'wood' || c.category === 'driver' || c.category === 'utility'
                        if (clubCategoryFilter === 'iron') return c.category === 'iron'
                        if (clubCategoryFilter === 'wedge') return c.category === 'wedge'
                        return true
                      })
                      .map((c) => {
                        const myApp = myOverallStats.clubStats[c.name]?.approachRate || DEFAULT_CLUB_APPROACH[c.name] || 75
                        const tApp = targetStats.clubStats[c.name]?.approachRate || DEFAULT_CLUB_APPROACH[c.name] || 75
                        return (
                          <div key={`app_${c.id}`}>
                            {renderDualBar(`${c.name} 핀 접근율`, myApp, tApp, 100, '%', false)}
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            )}

            {compareAnalysisTab === 'gir' && (
              <div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>⛳ 그린 적중률 (GIR) 및 접근율</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>평균 온그린 성공률과 세컨샷 정밀도 비교</p>
                </div>
                {renderDualBar('전체 그린 적중률 (GIR)', myOverallStats.girRate, targetStats.girRate, 100, '%', false)}
                {renderDualBar('전체 핀 평균 접근율', myOverallStats.approachRate, targetStats.approachRate, 100, '%', false)}
                {renderDualBar('페어웨이 세컨샷 GIR', myOverallStats.fwGirRate, targetStats.fwGirRate, 100, '%', false)}
                {renderDualBar('러프 탈출 세컨샷 GIR', myOverallStats.roughGirRate, targetStats.roughGirRate, 100, '%', false)}
                {renderDualBar('벙커 탈출 세컨샷 GIR', myOverallStats.bunkerGirRate, targetStats.bunkerGirRate, 100, '%', false)}
              </div>
            )}

            {compareAnalysisTab === 'shortgame' && (
              <div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>🏖️ 숏게임 세이브율 (Scrambling)</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>온그린 실패 시 파 이상을 지켜내는 위기관리 능력</p>
                </div>
                {renderDualBar('스크램블링 파 세이브율', myOverallStats.scrambleRate, targetStats.scrambleRate, 100, '%', false)}
                {renderDualBar('벙커 세이브율 (Sand Save)', myOverallStats.bunkerSaveRate, targetStats.bunkerSaveRate, 100, '%', false)}
              </div>
            )}

            {compareAnalysisTab === 'putting' && (
              <div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>🕳️ 퍼팅 통계 및 홀당 퍼트 수</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>홀당 퍼트 수 및 1/2/3퍼트 비율 비교</p>
                </div>
                {renderDualBar('홀당 평균 퍼트 수', myOverallStats.avgPutts, targetStats.avgPutts, 3.5, '개', true)}
                {renderDualBar('그린 적중(GIR) 시 퍼트 수', myOverallStats.girPutts, targetStats.girPutts, 3.5, '개', true)}
                {renderDualBar('18홀 환산 총 퍼팅 수', myOverallStats.totalPutts, targetStats.totalPutts, 50, '개', true)}
                {renderDualBar('1퍼트 달성 홀 수 (홀/라운드)', myOverallStats.onePutt, targetStats.onePutt, 18, '홀', false)}
                {renderDualBar('2퍼트 달성 홀 수 (홀/라운드)', myOverallStats.twoPutt, targetStats.twoPutt, 18, '홀', false)}
                {renderDualBar('3퍼트 이상 발생 홀 수', myOverallStats.threePutt, targetStats.threePutt, 18, '홀', true)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. 골프 업적 & 뱃지 현황 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px', marginTop: '16px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '14.5px', fontWeight: 'bold', color: '#1e293b' }}>
          🏅 나의 골프 뱃지 & 업적 컬렉션
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🏆</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>80타대 진입</div>
              <div style={{ fontSize: '10.5px', color: '#16a34a' }}>달성 완료 ({bestScoreRecorded}타)</div>
            </div>
          </div>
          <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🎯</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>페어웨이 명사수</div>
              <div style={{ fontSize: '10.5px', color: '#16a34a' }}>안착률 50% 돌파</div>
            </div>
          </div>
          <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🦅</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>버디 사냥꾼</div>
              <div style={{ fontSize: '10.5px', color: '#16a34a' }}>버디 기록 달성</div>
            </div>
          </div>
          <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>⛳</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>싱글 골퍼 도전</div>
              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>목표: 79타 이하</div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. 🌟 [신규] 유저 소통 & 기능 제안 오픈 게시판 섹션 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px', marginTop: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* 게시판 상단 타이틀 & 글쓰기 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px' }}>📢</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                서비스 제안 & 유저 소통 게시판
              </h3>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
              새로운 아이디어를 남겨주시면 개발팀이 직접 확인하고 댓글로 답변드립니다!
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {!isAdminAuthenticated ? (
              <button
                onClick={() => setIsAdminLoginPromptOpen(true)}
                style={{ padding: '7px 11px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                🔒 운영자 인증
              </button>
            ) : (
              <span style={{ fontSize: '11.5px', backgroundColor: '#047857', color: '#ffffff', padding: '5px 9px', borderRadius: '8px', fontWeight: 'bold' }}>
                👑 운영자 모드 ON
              </span>
            )}

            <button
              onClick={() => setIsWriteModalOpen(true)}
              style={{
                padding: '8px 14px',
                backgroundColor: '#047857',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 4px rgba(4,120,87,0.2)',
              }}
            >
              <span>✏️</span>
              <span>글 남기기</span>
            </button>
          </div>
        </div>

        {/* 게시판 카테고리 필터 버튼군 */}
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
          {[
            { id: 'all', label: '전체' },
            { id: 'suggestion', label: '💡 기능 제안' },
            { id: 'bug', label: '🐛 오류 신고' },
            { id: 'course', label: '⛳ 골프장 정보' },
            { id: 'general', label: '💬 자유 소통' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setBoardCategoryFilter(cat.id as any)}
              style={{
                flex: '0 0 auto',
                padding: '6px 11px',
                borderRadius: '20px',
                border: boardCategoryFilter === cat.id ? '1px solid #0f172a' : '1px solid #e2e8f0',
                backgroundColor: boardCategoryFilter === cat.id ? '#0f172a' : '#f8fafc',
                color: boardCategoryFilter === cat.id ? '#ffffff' : '#64748b',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 게시글 목록 카드 리스트 */}
        {filteredPosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8', fontSize: '13px' }}>
            등록된 게시글이 없습니다. 첫 번째 제안을 남겨보세요!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredPosts.map((post) => {
              const catBadge =
                post.category === 'suggestion' ? { label: '💡 기능제안', bg: '#ecfdf5', color: '#047857' } :
                post.category === 'bug' ? { label: '🐛 오류신고', bg: '#fef2f2', color: '#dc2626' } :
                post.category === 'course' ? { label: '⛳ 골프장', bg: '#eff6ff', color: '#2563eb' } :
                { label: '💬 자유소통', bg: '#f8fafc', color: '#475569' }

              const hasAdminComment = post.comments.some((c) => c.isAdmin)

              return (
                <div
                  key={post.id}
                  onClick={() => setSelectedPostDetail(post)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', backgroundColor: catBadge.bg, color: catBadge.color }}>
                        {catBadge.label}
                      </span>
                      {post.isSecret && (
                        <span style={{ fontSize: '10.5px', backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 5px', borderRadius: '4px', fontWeight: 600 }}>
                          🔒 비밀글
                        </span>
                      )}
                      {hasAdminComment && (
                        <span style={{ fontSize: '10.5px', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          ✓ 운영팀 답변완료
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{post.date}</span>
                  </div>

                  <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
                    {post.title}
                  </h4>

                  <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {post.content}
                  </p>

                  {/* 하단 반응 및 작성자 바 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '11.5px', color: '#64748b' }}>
                    <span>작성자: <strong>{post.author}</strong></span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {post.images && post.images.length > 0 && (
                        <span>📷 사진 {post.images.length}</span>
                      )}
                      <span
                        onClick={(e) => handleLikePost(post.id, e)}
                        style={{ cursor: 'pointer', color: post.likes > 0 ? '#dc2626' : '#64748b' }}
                      >
                        👍 공감 {post.likes}
                      </span>
                      <span style={{ color: post.comments.length > 0 ? '#2563eb' : '#64748b', fontWeight: post.comments.length > 0 ? 'bold' : 'normal' }}>
                        💬 댓글 {post.comments.length}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 7. [모달] 게시글 작성 모달 */}
      {isWriteModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '22px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', color: '#0f172a' }}>
                ✏️ 제안 및 소통 글 작성하기
              </h3>
              <button
                onClick={() => setIsWriteModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePost}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>분류 선택</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '4px' }}>
                  {[
                    { id: 'suggestion', label: '💡 기능 제안' },
                    { id: 'bug', label: '🐛 오류 신고' },
                    { id: 'course', label: '⛳ 골프장 정보' },
                    { id: 'general', label: '💬 자유 소통' },
                  ].map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setNewPostForm({ ...newPostForm, category: cat.id as any })}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: newPostForm.category === cat.id ? '2px solid #047857' : '1px solid #cbd5e1',
                        backgroundColor: newPostForm.category === cat.id ? '#ecfdf5' : '#ffffff',
                        color: newPostForm.category === cat.id ? '#047857' : '#475569',
                        fontSize: '12px',
                        fontWeight: newPostForm.category === cat.id ? 'bold' : 'normal',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>제목</label>
                <input
                  type="text"
                  value={newPostForm.title}
                  onChange={(e) => setNewPostForm({ ...newPostForm, title: e.target.value })}
                  placeholder="제목을 간결하게 입력해주세요"
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', marginTop: '4px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>내용</label>
                <textarea
                  rows={5}
                  value={newPostForm.content}
                  onChange={(e) => setNewPostForm({ ...newPostForm, content: e.target.value })}
                  placeholder="개선 제안 내용이나 나누고 싶은 의견을 자유롭게 적어주세요."
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px', boxSizing: 'border-box', resize: 'vertical' }}
                  required
                />
              </div>

              {/* 사진 첨부 */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    사진 첨부 ({newPostForm.images.length}/3장)
                  </label>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>스크린샷 등 첨부</span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {newPostForm.images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      style={{ position: 'relative', width: '68px', height: '68px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}
                    >
                      <img src={imgUrl} alt="첨부" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setNewPostForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))}
                        style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', fontSize: '10px', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {newPostForm.images.length < 3 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ width: '68px', height: '68px', borderRadius: '8px', border: '1.5px dashed #94a3b8', backgroundColor: '#f8fafc', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', cursor: 'pointer', fontSize: '11px' }}
                    >
                      <span style={{ fontSize: '18px' }}>📷</span>
                      <span>추가</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 비밀글 옵션 */}
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="secretCheck"
                  checked={newPostForm.isSecret}
                  onChange={(e) => setNewPostForm({ ...newPostForm, isSecret: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="secretCheck" style={{ fontSize: '12.5px', color: '#475569', cursor: 'pointer' }}>
                  🔒 비밀글로 등록 (작성자와 운영자만 열람)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsWriteModalOpen(false)}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', backgroundColor: '#047857', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. [모달] 게시글 상세 & 댓글/답변 모달 */}
      {selectedPostDetail && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '12px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            
            {/* 상세 헤더 */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '3px 7px', borderRadius: '4px', backgroundColor: '#0f172a', color: '#ffffff' }}>
                  {selectedPostDetail.category === 'suggestion' ? '💡 기능 제안' : selectedPostDetail.category === 'bug' ? '🐛 오류 신고' : '💬 소통'}
                </span>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                  작성자: <strong>{selectedPostDetail.author}</strong> · {selectedPostDetail.date}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {(isAdminAuthenticated || selectedPostDetail.author === profile.nickname) && (
                  <button
                    onClick={() => handleDeletePost(selectedPostDetail.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    삭제
                  </button>
                )}
                <button
                  onClick={() => setSelectedPostDetail(null)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 상세 본문 & 댓글 영역 */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: 'bold', color: '#0f172a' }}>
                {selectedPostDetail.title}
              </h3>

              <div style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                {selectedPostDetail.content}
              </div>

              {/* 첨부 사진 */}
              {selectedPostDetail.images && selectedPostDetail.images.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {selectedPostDetail.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt="첨부사진"
                      style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  ))}
                </div>
              )}

              {/* 공감 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                <button
                  onClick={(e) => handleLikePost(selectedPostDetail.id, e)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '20px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: selectedPostDetail.likes > 0 ? '#fef2f2' : '#ffffff',
                    color: selectedPostDetail.likes > 0 ? '#dc2626' : '#475569',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>👍 공감해요</span>
                  <span>{selectedPostDetail.likes}</span>
                </button>
              </div>

              {/* 댓글 목록 */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
                  💬 댓글 ({selectedPostDetail.comments.length})
                </h4>

                {selectedPostDetail.comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '12.5px' }}>
                    아직 등록된 댓글이 없습니다. 첫 의견을 남겨주세요!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {selectedPostDetail.comments.map((cmt) => (
                      <div
                        key={cmt.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          backgroundColor: cmt.isAdmin ? '#f0fdf4' : '#f8fafc',
                          border: cmt.isAdmin ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ fontSize: '12.5px', color: cmt.isAdmin ? '#166534' : '#1e293b' }}>
                              {cmt.author}
                            </strong>
                            {cmt.isAdmin && (
                              <span style={{ fontSize: '10px', backgroundColor: '#047857', color: '#ffffff', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                                👑 운영팀
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>{cmt.date}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                          {cmt.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 댓글 작성창 */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={isAdminAuthenticated ? '👑 운영팀 공식 답변을 작성하세요...' : '따뜻한 댓글을 남겨주세요...'}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '9px 16px',
                    backgroundColor: isAdminAuthenticated ? '#0f172a' : '#047857',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  등록
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* 9. [모달] 운영자 로그인 팝업 */}
      {isAdminLoginPromptOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '22px', width: '100%', maxWidth: '330px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
              🔒 운영자 모드 인증
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b' }}>
              인증 시 공식 [👑 운영팀] 답변 댓글을 달 수 있습니다.
            </p>
            <form onSubmit={handleAdminAuth}>
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="운영자 비밀번호"
                style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', marginBottom: '12px', boxSizing: 'border-box' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsAdminLoginPromptOpen(false)}
                  style={{ flex: 1, padding: '9px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12.5px' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '9px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12.5px' }}
                >
                  인증하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. 내 정보 수정 모달 */}
      {isEditModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>👤 내 프로필 및 골프 정보 수정</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>닉네임</label>
                <input
                  type="text"
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>골프 구력 (연수)</label>
                  <input
                    type="number"
                    value={editForm.experienceYears || ''}
                    onChange={(e) => setEditForm({ ...editForm, experienceYears: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>베스트 스코어 (라베)</label>
                  <input
                    type="number"
                    value={editForm.bestScore || ''}
                    onChange={(e) => setEditForm({ ...editForm, bestScore: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>주 활동 지역</label>
                <input
                  type="text"
                  value={editForm.region}
                  onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                  placeholder="예: 서울 / 경기, 부산 / 경남"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>선호 골프장 (홈 코스)</label>
                <input
                  type="text"
                  value={editForm.favoriteCourse}
                  onChange={(e) => setEditForm({ ...editForm, favoriteCourse: e.target.value })}
                  placeholder="예: 안양CC, 동래베네스트CC"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{ flex: 1, padding: '10px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={handleSaveProfile}
                style={{ flex: 1, padding: '10px', backgroundColor: '#047857', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. 과거 라운드 상세 분석 리포트 오버레이 모달 */}
      {selectedRoundDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '10px',
          }}
        >
          <div
            style={{
              backgroundColor: '#f8fafc',
              borderRadius: '16px',
              padding: '18px 16px',
              width: '100%',
              maxWidth: '960px',
              maxHeight: '94vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                paddingBottom: '10px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📊</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                    {selectedRoundDetail.date} 라운드 상세 분석 리포트
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                    스코어 / 드라이버 / 클럽별 / GIR / 숏게임 / 퍼팅 상세 진단 데이터
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedRoundDetail(null)}
                style={{
                  border: 'none',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            <RoundReport
              savedRound={selectedRoundDetail}
              isHistoryView={true}
              onClose={() => setSelectedRoundDetail(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}