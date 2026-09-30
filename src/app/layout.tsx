import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import localFont from 'next/font/local'
import { getLocale, getTranslations } from 'next-intl/server'
import './globals.css'
import { MagneticCursor } from '@/components/ui/magnetic-cursor'

/** 한글·영문 공통 글꼴: 세종글꽃체 (Regular 1종). 라이선스상 변형 재배포 금지라 원본 TTF를 그대로 쓴다. */
const sejong = localFont({
  src: './fonts/SejongGeulggot.ttf',
  variable: '--font-sejong',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('title'), description: t('description') }
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getLocale()

  return (
    <html lang={locale} className={sejong.variable}>
      <body className="min-h-screen bg-ink font-sans text-cream antialiased">
        <NextIntlClientProvider>
          <MagneticCursor magneticFactor={0.35} cursorSize={28}>
            {children}
          </MagneticCursor>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
