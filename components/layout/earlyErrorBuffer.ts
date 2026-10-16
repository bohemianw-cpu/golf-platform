import type { ClientErrorKind } from '@/utils/error-report'

/** 화면이 브라우저에서 준비되기 전에 생긴 오류. 오류 보고기가 붙으면 꺼내 보낸다. */
export interface EarlyClientError {
  kind: ClientErrorKind
  reason: unknown
}

declare global {
  interface Window {
    __golfEarlyErrors?: EarlyClientError[]
    __golfStopEarlyErrors?: () => void
  }
}

/**
 * 페이지 맨 앞(root layout의 beforeInteractive 스크립트)에서 실행하는 코드.
 * 오류 보고기(ErrorReporter)가 붙기 전에 생긴 오류를 최대 10개까지 모아 둔다.
 */
export const EARLY_ERROR_BUFFER_SCRIPT = `(function () {
  var queue = [];
  function onError(event) { if (queue.length < 10) queue.push({ kind: 'error', reason: event.error || event.message }); }
  function onRejection(event) { if (queue.length < 10) queue.push({ kind: 'unhandledrejection', reason: event.reason }); }
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  window.__golfEarlyErrors = queue;
  window.__golfStopEarlyErrors = function () {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
})();`

/** 모아 둔 오류를 꺼내고, 이후로는 모으지 않게 한다. */
export function takeEarlyErrors(): EarlyClientError[] {
  if (typeof window === 'undefined') return []
  window.__golfStopEarlyErrors?.()
  // 같은 배열을 비워 돌려준다. 두 번 불러도 같은 오류를 다시 꺼내지 않는다.
  return window.__golfEarlyErrors?.splice(0) ?? []
}
