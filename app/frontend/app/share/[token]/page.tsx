"use client"
import React from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getApiBase } from '@/lib/apiClient'

export default function SharePage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const proj = useQuery({ queryKey: ['share', token, 'project'], queryFn: async () => fetch(`${getApiBase()}/share/${token}/project`).then((r) => r.json()), enabled: !!token })
  const files = useQuery({ queryKey: ['share', token, 'files'], queryFn: async () => fetch(`${getApiBase()}/share/${token}/files`).then((r) => r.json()), enabled: !!token })
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">{proj.data?.name || 'Shared Project'}</h1>
      <p className="mb-4 text-muted-foreground">Read-only share</p>
      <div className="rounded border">
        <div className="border-b p-2 text-sm font-semibold">Files</div>
        <div className="max-h-[60vh] overflow-auto p-2">
          {files.data && files.data.length > 0 ? (
            <ul>
              {files.data.map((f: any) => (
                <li key={f.id} className="my-1">
                  <a className="text-blue-600 hover:underline" href={`#`} onClick={async (e) => {
                    e.preventDefault()
                    const j = await fetch(`${getApiBase()}/share/${token}/file?path=${encodeURIComponent(f.path)}`).then((r) => r.json())
                    alert(j.content)
                  }}>{f.path}</a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">No files or link expired.</div>
          )}
        </div>
      </div>
    </div>
  )
}

