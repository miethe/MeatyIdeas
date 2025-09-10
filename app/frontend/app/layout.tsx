import './globals.css'
import 'prismjs/themes/prism-tomorrow.css'
import React from 'react'
import Providers from '@/components/providers'
import { cn } from '@/lib/utils'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn('dark')}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
