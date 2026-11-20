import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Noto_Sans_Devanagari } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/components/AppProvider'
import { TopBar } from '@/components/TopBar'
import { BottomNav } from '@/components/BottomNav'
import { OfflineBanner } from '@/components/OfflineBanner'
import { MainShell } from '@/components/MainShell'
import { ServiceWorker } from '@/components/ServiceWorker'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
})

const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-devanagari',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sasta Dawa — same medicine, lower price, near you',
  description:
    'Find the same salt cheaper, see which pharmacy nearby has it, and check the government schemes you can use. Hindi, English and Awadhi.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Sasta Dawa', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon-192.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0F766E' },
    { media: '(prefers-color-scheme: dark)', color: '#061412' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${devanagari.variable}`}>
        <AppProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[70] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
          >
            Skip to content
          </a>
          <TopBar />
          <OfflineBanner />
          <MainShell>{children}</MainShell>
          <BottomNav />
          <ServiceWorker />
        </AppProvider>
      </body>
    </html>
  )
}
