"use client"
import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CommandPalette } from '@/components/search-command'
import { ThemeToggle } from '@/components/theme-toggle'
import { Search, Plus } from 'lucide-react'
import Link from 'next/link'
import { ProjectCreateSheet } from '@/components/projects/project-create-sheet'
import { useHotkeys } from 'react-hotkeys-hook'

export function AppShell({ children }: { children: React.ReactNode }) {
  useHotkeys('n', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
    e.preventDefault()
    window.dispatchEvent(new Event('open-new-project'))
  })
  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] grid-rows-[56px_1fr]">
      <header className="col-span-2 flex items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary" />
          <Link href="/" className="font-semibold">MeatyProjects</Link>
        </div>
        <div className="flex items-center gap-2">
          <CommandPalette>
            <Button variant="outline" size="sm" className="gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="ml-2 hidden rounded bg-muted px-1 text-xs text-muted-foreground sm:inline">⌘K</kbd>
            </Button>
          </CommandPalette>
          <ThemeToggle />
        </div>
      </header>
      <aside className="row-start-2 border-r p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs uppercase text-muted-foreground">Projects</span>
          <ProjectCreateSheet>
            <Button size="sm" variant="secondary" className="gap-1">
              <Plus className="h-4 w-4" /> New
            </Button>
          </ProjectCreateSheet>
        </div>
        <nav className="space-y-1 text-sm">
          <a className="block rounded px-2 py-1 hover:bg-accent hover:text-accent-foreground" href="/">All</a>
        </nav>
      </aside>
      <main className={cn('row-start-2 overflow-y-auto p-6')}>{children}</main>
    </div>
  )
}
