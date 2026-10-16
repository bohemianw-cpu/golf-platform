import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'

test('sign-up is blocked before reaching Supabase when the password appears in a breach', async ({ page }) => {
  const leaked = 'golfsecretary123'
  const hash = createHash('sha1').update(leaked).digest('hex').toUpperCase()
  const authRequests: string[] = []
  await page.route('**/range/*', (route) => route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: `${hash.slice(5)}:42\r\n0000000000000000000000000000000000A:0` }))
  await page.route('**/auth/v1/**', (route) => {
    authRequests.push(new URL(route.request().url()).pathname)
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/home')
  await page.getByRole('button', { name: '로그인 / 회원가입' }).first().click()
  await page.getByRole('button', { name: '계정이 없으신가요? 회원가입' }).click()
  await page.getByPlaceholder('사용할 닉네임').fill('새골퍼')
  await page.getByPlaceholder('example@golf.com').fill('new-golfer@example.invalid')
  await page.getByPlaceholder('8자 이상, 다른 곳에서 쓰지 않는 비밀번호').fill(leaked)
  await page.getByLabel('[필수] 서비스 이용약관 동의').check()
  await page.getByLabel('[필수] 개인정보 처리 안내 확인').check()
  await page.getByLabel('[필수] 만 14세 이상입니다').check()
  await page.locator('form button[type="submit"]').click()

  await expect(page.getByText(/유출된 적이 있는 비밀번호/)).toBeVisible()
  expect(authRequests.filter((path) => path.endsWith('/signup'))).toEqual([])
})
