import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

// Archivo — variable font (wdth,wght), used at 700/800/900 for display/UI
// emphasis per design-reference/design-tokens.md. Single variable TTF.
const archivo = localFont({
  src: './fonts/Archivo-VariableFont.ttf',
  variable: '--font-archivo',
  display: 'swap',
  weight: '400 900',
})

// Space Grotesk — body/default font (400-700) used throughout both the
// design-tokens docs and the mined dashboard/home reference HTML.
const spaceGrotesk = localFont({
  src: [
    { path: './fonts/SpaceGrotesk-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/SpaceGrotesk-Medium.ttf', weight: '500', style: 'normal' },
    { path: './fonts/SpaceGrotesk-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: './fonts/SpaceGrotesk-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MOVED. CRM',
  description: 'Workout builder and publishing tool for MOVED.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${spaceGrotesk.variable}`}>
      <body className="font-body text-ink-900">{children}</body>
    </html>
  )
}
