'use client'

import { createClient } from '@/utils/supabase/client'
import { buildClientErrorReport, createErrorReporter, type ClientErrorKind } from '@/utils/error-report'

// 화면 전체가 같은 보고기를 써서 같은 오류를 한 번만 보낸다. 로그인하지 않았으면 DB가 받지 않는다.
let send: ReturnType<typeof createErrorReporter> | null = null

export function reportClientError(kind: ClientErrorKind, reason: unknown, digest?: string | null) {
  if (typeof window === 'undefined') return
  if (!send) {
    const supabase = createClient()
    send = createErrorReporter(async (report) => {
      const { error } = await supabase.rpc('report_client_error', {
        p_kind: report.kind,
        p_message: report.message,
        p_stack: report.stack,
        p_path: report.path,
        p_digest: report.digest,
      })
      if (error) throw error
    })
  }
  send(buildClientErrorReport(kind, reason, window.location.pathname, digest))
}
