// Golf Secretary 서비스 워커: 신호가 없는 곳에서도 앱 화면이 열리게 한다.
// - 앱 코드(/_next/static)는 배포마다 이름이 바뀌어 내용이 변하지 않으므로 저장본을 먼저 쓴다.
// - 페이지와 그 밖의 같은 사이트 파일은 네트워크를 먼저 쓰고, 실패하면 저장본을 쓴다.
// - 로그인·DB(Supabase, 다른 사이트)와 /api는 가로채지 않는다. 기록 저장은 앱이 따로 다시 보낸다.
// 저장 방식이 바뀌면 VERSION을 올려 예전 저장본을 지운다.
const VERSION = 'v1'
const STATIC_CACHE = `golf-static-${VERSION}`
const PAGE_CACHE = `golf-pages-${VERSION}`
// 처음 설치할 때 미리 저장해 두는 화면. 라운드 중 가장 많이 여는 곳이다.
const PRECACHE_PAGES = ['/score', '/home', '/my']

const pageKey = (url) => new Request(new URL(url).origin + new URL(url).pathname)

async function precache() {
  const pages = await caches.open(PAGE_CACHE)
  const statics = await caches.open(STATIC_CACHE)
  for (const path of PRECACHE_PAGES) {
    try {
      const response = await fetch(path, { credentials: 'same-origin' })
      if (!response.ok) continue
      const html = await response.clone().text()
      await pages.put(pageKey(new URL(path, self.location.origin).href), response)
      // 그 화면을 그리는 데 필요한 앱 코드도 함께 저장한다.
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])]
      await Promise.all(assets.map((asset) => statics.add(asset).catch(() => undefined)))
    } catch {
      // 설치 중 연결이 끊겨도 설치는 마친다. 다음에 연결될 때 페이지를 열면서 저장된다.
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, PAGE_CACHE])
    for (const name of await caches.keys()) if (name.startsWith('golf-') && !keep.has(name)) await caches.delete(name)
    await self.clients.claim()
  })())
})

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

async function networkFirst(request, cacheName, key = request) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') await cache.put(key, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(key)
    if (cached) return cached
    throw error
  }
}

const OFFLINE_PAGE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인 | Golf Secretary</title></head>
<body style="margin:0;font-family:sans-serif;background:#f8fafc;color:#0f172a;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box">
<main style="max-width:360px;text-align:center"><h1 style="font-size:20px">인터넷 연결이 없어요</h1>
<p style="color:#475569;line-height:1.6">이 화면은 아직 이 기기에 저장되지 않았어요. 연결된 상태에서 한 번 열어 두면 다음부터는 연결 없이도 열 수 있어요.</p>
<p><a href="/score" style="color:#047857;font-weight:700">스코어 기록으로 가기</a></p></main></body></html>`

async function page(request) {
  try {
    return await networkFirst(request, PAGE_CACHE, pageKey(request.url))
  } catch {
    // 첫 화면(/)은 저장해 둔 스코어 화면으로 연다. 저장본이 없는 화면은 안내 페이지를 보여 준다.
    if (new URL(request.url).pathname === '/') {
      const score = await (await caches.open(PAGE_CACHE)).match(pageKey(new URL('/score', self.location.origin).href))
      if (score) return score
    }
    return new Response(OFFLINE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return
  if (url.pathname.startsWith('/_next/static/')) event.respondWith(cacheFirst(request))
  else if (request.mode === 'navigate') event.respondWith(page(request))
  else event.respondWith(networkFirst(request, PAGE_CACHE))
})
