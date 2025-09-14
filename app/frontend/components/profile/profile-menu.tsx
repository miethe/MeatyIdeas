"use client"
import React from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiGet, apiJson } from '@/lib/apiClient'
import { toast } from 'sonner'

type User = { id: string; name: string; email: string; avatar_url?: string | null }

export function ProfileMenu() {
  const [open, setOpen] = React.useState(false)
  const [user, setUser] = React.useState<User | null>(null)
  React.useEffect(() => {
    apiGet<User>('/me').then(setUser).catch(() => setUser({ id: 'local', name: 'Local User', email: '' }))
  }, [])

  async function logout() {
    try {
      await apiJson('POST', '/me/logout', {})
    } catch {}
    try { localStorage.removeItem('token') } catch {}
    toast.success('Logged out')
    window.location.href = '/'
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label="Profile" className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium">
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt={user.name} className="h-8 w-8 object-cover" />
            ) : (
              <span>{(user?.name || 'U').slice(0, 1).toUpperCase()}</span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="truncate max-w-[200px]">{user?.name || 'User'}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setOpen(true)}>View / Edit Profile</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onSelect={logout}>Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileDialog open={open} onOpenChange={setOpen} user={user} onUpdated={setUser} />
    </>
  )
}

function ProfileDialog({ open, onOpenChange, user, onUpdated }: { open: boolean; onOpenChange: (b: boolean) => void; user: User | null; onUpdated: (u: User) => void }) {
  const [name, setName] = React.useState(user?.name || '')
  const [email, setEmail] = React.useState(user?.email || '')
  const [avatar, setAvatar] = React.useState(user?.avatar_url || '')
  React.useEffect(() => {
    setName(user?.name || '')
    setEmail(user?.email || '')
    setAvatar(user?.avatar_url || '')
  }, [user])
  async function save() {
    try {
      const u = await apiJson<User>('PATCH', '/me', { name, email, avatar_url: avatar })
      onUpdated(u)
      onOpenChange(false)
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Name<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>
          <label className="block text-sm font-medium">Email<input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>
          <label className="block text-sm font-medium">Avatar URL<input value={avatar} onChange={(e) => setAvatar(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="rounded border px-3 py-1" onClick={() => onOpenChange(false)}>Cancel</button>
            <button className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={save}>Save</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

