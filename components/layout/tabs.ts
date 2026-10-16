// 하단 메뉴의 탭. 탭마다 고유한 주소를 갖는다.
export const TAB_ITEMS = [
  { href: '/home', icon: '🏠', label: '홈' },
  { href: '/join', icon: '👥', label: '조인/벙개' },
  { href: '/score', icon: '⛳', label: '스코어' },
  { href: '/video', icon: '🎬', label: '영상' },
  { href: '/lesson', icon: '👨‍🏫', label: '레슨' },
  { href: '/shop', icon: '🛒', label: '쇼핑' },
  { href: '/my', icon: '👤', label: 'MY' },
] as const
