'use client'

import { color, palette } from '@/utils/theme'
import { TAB_ITEMS } from './tabs'
import Link from 'next/link'

/** 하단 메뉴: 탭 링크와 현재 탭 표시. 스크롤하면 숨는다. */
export default function BottomNav({ chromeVisible, pathname }: { chromeVisible: boolean; pathname: string }) {
  return (
    <>
      <nav
        aria-hidden={!chromeVisible}
        inert={!chromeVisible}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: palette.white,
          borderTop: `1px solid ${palette.slate200}`,
          height: '64px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
          transform: chromeVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 220ms ease',
        }}
      >
        {TAB_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              style={{
                flex: 1,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                color: isActive ? color.brand : palette.slate500,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '18px', filter: isActive ? 'none' : 'grayscale(40%)' }}>{item.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: isActive ? 'bold' : 'normal', marginTop: '2px' }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
