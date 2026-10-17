// 하단 메뉴의 탭. 탭마다 고유한 주소를 갖는다. comingSoon인 탭은 아직 준비 중이라 메뉴에 "곧 열려요"를 붙인다.
export const TAB_ITEMS = [
  { href: '/home', icon: '🏠', label: '홈', comingSoon: false },
  { href: '/join', icon: '👥', label: '조인/벙개', comingSoon: true },
  { href: '/score', icon: '⛳', label: '스코어', comingSoon: false },
  { href: '/video', icon: '🎬', label: '영상', comingSoon: true },
  { href: '/lesson', icon: '👨‍🏫', label: '레슨', comingSoon: true },
  { href: '/shop', icon: '🛒', label: '쇼핑', comingSoon: true },
  { href: '/my', icon: '👤', label: 'MY', comingSoon: false },
] as const
