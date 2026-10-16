import { expect, test, type Page } from '@playwright/test'
import { mockCourseSearch, mockSignedInApp } from './support/mockApp'

/**
 * 화면에 보이는 글자 중 배경과의 명도 대비가 WCAG AA 기준(보통 글자 4.5:1, 큰 글자 3:1)에 못 미치는 것을 찾는다.
 * 비활성 컨트롤과 숨긴 요소는 기준에서 빠지므로 제외하고, 배경 그림·그라데이션 위 글자는 잴 수 없어 건너뛴다.
 */
async function expectReadable(page: Page, label: string) {
  const found = await page.evaluate(() => {
    const parse = (c: string) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/).filter(Boolean); return [Number(r), Number(g), Number(b), Number(a)] }
    const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
    const bgOf = (el: Element | null): number[] | null => {
      const layers: number[][] = []
      for (let node = el; node; node = node.parentElement) {
        const s = getComputedStyle(node)
        if (s.backgroundImage !== 'none') return null
        const c = parse(s.backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break }
      }
      let out = [255, 255, 255]
      for (const c of layers.reverse()) out = out.map((v, i) => c[i] * c[3] + v * (1 - c[3]))
      return out
    }
    const out: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim(); const el = n.parentElement
      if (!text || !el || !/[\p{L}\p{N}]/u.test(text)) continue
      if (el.closest('[aria-hidden=true], script, style, [inert]')) continue
      if (el.closest('button:disabled, input:disabled, select:disabled, fieldset:disabled, [aria-disabled=true]')) continue
      const s = getComputedStyle(el); const rect = el.getBoundingClientRect()
      if (s.visibility === 'hidden' || rect.width === 0 || Number(s.opacity) < 0.1) continue
      let opacity = 1; for (let node: Element | null = el; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity)
      const fg = parse(s.color); const bg = bgOf(el); if (!fg || !bg) continue
      const a = fg[3] * opacity; const mixed = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a))
      const L1 = lum(mixed), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
      const size = parseFloat(s.fontSize); const bold = Number(s.fontWeight) >= 700
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
      if (ratio < need) out.push(`${ratio.toFixed(2)} < ${need} | ${s.color} on rgb(${bg.map(Math.round).join(',')}) op${opacity.toFixed(2)} | ${size}px | "${text.slice(0, 40)}"`)
    }
    return [...new Set(out)]
  })
  expect(found, label).toEqual([])
}

test('signed-out pages and the login window have readable text contrast', async ({ page }) => {
  await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }))
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }))
  await page.goto('/home'); await page.waitForTimeout(800); await expectReadable(page, '로그아웃 홈')
  await page.getByRole('button', { name: '로그인 / 회원가입' }).click(); await expectReadable(page, '로그인 창')
  await page.getByRole('button', { name: '계정이 없으신가요? 회원가입' }).click(); await expectReadable(page, '회원가입 창')
})

test('score, MY and other tabs have readable text contrast through a round', async ({ page }) => {
  await mockSignedInApp(page, { draft: false })
  await mockCourseSearch(page)
  await page.goto('/score'); await page.waitForTimeout(1000); await expectReadable(page, '스코어 빈 화면')
  await page.getByRole('searchbox', { name: '골프장 이름 검색' }).click(); await page.waitForTimeout(500); await expectReadable(page, '골프장 검색')
  await page.getByRole('list', { name: '골프장 검색 결과' }).getByText('서버복구 CC').click(); await page.waitForTimeout(800); await expectReadable(page, '골프장 선택')
  await page.getByRole('checkbox', { name: 'OUT 코스 1홀 코스' }).check(); await page.getByRole('radio', { name: '화이트티' }).check()
  await page.getByRole('button', { name: '라운드 시작', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: '확인' }).click(); await page.waitForTimeout(600); await expectReadable(page, '라운드 진행')
  await page.getByRole('button', { name: /클럽 설정/ }).click(); await page.waitForTimeout(500); await expectReadable(page, '클럽 설정'); await page.keyboard.press('Escape')
  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('0'); await page.getByRole('button', { name: '🏁 홀아웃 기록' }).click(); await page.waitForTimeout(500); await expectReadable(page, '홀 결과')
  await page.getByRole('dialog').getByRole('button', { name: '라운드 리포트 보기' }).click(); await page.waitForTimeout(800); await expectReadable(page, '라운드 리포트')
  for (const path of ['/home', '/my', '/join', '/video', '/lesson', '/shop']) { await page.goto(path); await page.waitForTimeout(1000); await expectReadable(page, path) }
})

test('the offline notice on the score tab has readable text contrast', async ({ page, context }) => {
  await mockSignedInApp(page)
  await page.goto('/score')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  await context.setOffline(true)
  await page.getByText('인터넷 연결이 끊겼어요').waitFor()
  // 이어하기 직후 샷 내역이 서서히 나타나는 0.2초 전환이 끝난 뒤 잰다.
  await page.waitForTimeout(600)
  await expectReadable(page, '오프라인 안내')
  await context.setOffline(false)
})
