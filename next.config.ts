import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  // 폰 등 다른 기기로 개발 서버(`npm run dev -- -H 0.0.0.0`)에 접속할 때,
  // 그 기기의 내부 IP를 여기 추가해야 할 수 있다. (참고: docs/allowedDevOrigins)
  // allowedDevOrigins: ['192.168.0.10'],
}

export default withNextIntl(nextConfig)
