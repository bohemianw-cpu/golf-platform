export type ClientErrorKind = 'error' | 'unhandledrejection' | 'render'

export interface ClientErrorReport {
  kind: ClientErrorKind
  message: string
  stack: string | null
  path: string
  digest: string | null
}

const MESSAGE_LIMIT = 500
const STACK_LIMIT = 2000
const PATH_LIMIT = 200
const EMAIL_PATTERN = /[^\s@<>()"']+@[^\s@<>()"']+\.[^\s@<>()"']+/g

const maskEmails = (text: string) => text.replace(EMAIL_PATTERN, '[이메일]')

/** 경로의 쿼리·해시(로그인 메일 링크의 code 등)를 버린다. */
export const reportPath = (raw: string) => (raw.split(/[?#]/)[0] || '/').slice(0, PATH_LIMIT)

function describe(reason: unknown): { message: string; stack: string | null } {
  if (reason instanceof Error) return { message: reason.message || reason.name, stack: reason.stack ?? null }
  if (typeof reason === 'string') return { message: reason, stack: null }
  try {
    return { message: JSON.stringify(reason) ?? String(reason), stack: null }
  } catch {
    return { message: String(reason), stack: null }
  }
}

/** 서버로 보낼 오류 보고를 만든다. 이메일은 가리고 길이를 자른다. */
export function buildClientErrorReport(kind: ClientErrorKind, reason: unknown, path: string, digest?: string | null): ClientErrorReport {
  const { message, stack } = describe(reason)
  return {
    kind,
    message: maskEmails(message.trim() || '(빈 메시지)').slice(0, MESSAGE_LIMIT),
    stack: stack ? maskEmails(stack).slice(0, STACK_LIMIT) : null,
    path: reportPath(path),
    digest: digest ? digest.slice(0, 100) : null,
  }
}

/**
 * 같은 오류가 반복돼도 한 화면에서 한 번만, 최대 10건까지만 보낸다.
 * 보내기 실패는 다시 오류로 보고하지 않는다.
 */
export function createErrorReporter(send: (report: ClientErrorReport) => Promise<unknown>, limit = 10) {
  const seen = new Set<string>()
  return (report: ClientErrorReport) => {
    const key = `${report.kind}:${report.message}:${report.path}`
    if (seen.has(key) || seen.size >= limit) return false
    seen.add(key)
    void send(report).catch(() => undefined)
    return true
  }
}
