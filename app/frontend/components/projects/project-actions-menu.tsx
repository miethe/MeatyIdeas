"use client"

import React from 'react'
import { MoreHorizontal, Pencil, Tag as TagIcon, Trash2 } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

type ProjectActionsMenuProps = {
  onEdit?: () => void
  onManageGroups?: () => void
  onDelete?: () => void
  align?: 'start' | 'end'
}

export function ProjectActionsMenu({ onEdit, onManageGroups, onDelete, align = 'end' }: ProjectActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Project actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44">
        <DropdownMenuLabel>Project actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onEdit?.()
          }}
          disabled={!onEdit}
        >
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onManageGroups?.()
          }}
          disabled={!onManageGroups}
        >
          <TagIcon className="mr-2 h-4 w-4" /> Manage groups
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(event) => {
            event.preventDefault()
            onDelete?.()
          }}
          disabled={!onDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

