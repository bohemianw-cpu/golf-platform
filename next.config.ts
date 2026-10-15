import type { NextConfig } from "next";

// 모든 응답에 붙이는 기본 보안 헤더. 스크립트 출처를 제한하는 전체 CSP는 Next 스크립트와 함께 따로 검토한다.
const securityHeaders = [
  // 다른 사이트가 이 앱을 iframe으로 끼워 넣어 클릭을 가로채지 못하게 한다.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // 파일 형식을 브라우저가 멋대로 추측하지 않게 한다.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 다른 사이트로 이동할 때 전체 주소(로그인 code 등)를 넘기지 않는다.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 쓰지 않는 카메라·마이크·위치 권한은 요청할 수 없게 한다.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
