import type { MetadataRoute } from 'next'
import { color, palette } from '@/utils/theme'

// 휴대폰 홈 화면에 앱처럼 설치할 때 쓰는 정보. 설치하면 주소창 없이 열리고, 라운드 중 가장 많이 쓰는 스코어 탭에서 시작한다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Golf Secretary 골프 비서',
    short_name: '골프 비서',
    description: '라운드와 샷 기록을 저장하고 내 플레이를 분석하는 골프 플랫폼',
    lang: 'ko',
    start_url: '/score',
    scope: '/',
    display: 'standalone',
    background_color: palette.slate50,
    theme_color: color.brand,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
