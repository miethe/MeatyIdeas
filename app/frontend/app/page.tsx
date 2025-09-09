"use client"

import React from 'react'

async function fetchProjects() {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080/api'
  const res = await fetch(`${base}/projects`, {
    headers: { 'X-Token': process.env.NEXT_PUBLIC_TOKEN || 'devtoken' },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json()
}

export default async function Page() {
  const projects = await fetchProjects()
  return (
    <main>
      <h1 className="text-2xl font-bold mb-4">MeatyProjects</h1>
      <p className="mb-4">API-backed Markdown projects. OpenAPI at /api/docs.</p>
      <h2 className="text-xl font-semibold">Projects</h2>
      <ul className="list-disc pl-6">
        {projects.map((p: any) => (
          <li key={p.id}>{p.name} <span className="text-gray-500">({p.slug})</span></li>
        ))}
      </ul>
    </main>
  )
}

