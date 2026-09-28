import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  // 폰 등 다른 기기에서 개발 서버에 접속하려면 PC의 내부 IP(폰 주소창에 입력하는 IP)를
  // 여기 추가해야 한다. 없으면 HMR 연결이 403으로 막힌다. (참고: docs/allowedDevOrigins)
  // allowedDevOrigins: ['192.168.0.10'],
}

export default withNextIntl(nextConfig)
