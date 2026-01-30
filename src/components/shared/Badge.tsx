import { cn } from '@/lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
  children: ReactNode
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-primary-100 text-primary-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

// Priority-specific badge
interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const priorityMap = {
    low: { variant: 'default' as const, label: 'Low' },
    medium: { variant: 'info' as const, label: 'Medium' },
    high: { variant: 'warning' as const, label: 'High' },
    urgent: { variant: 'danger' as const, label: 'Urgent' },
  }

  const { variant, label } = priorityMap[priority]
  return <Badge variant={variant}>{label}</Badge>
}

// Status-specific badge
interface StatusBadgeProps {
  status: 'new' | 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusMap = {
    new: { variant: 'primary' as const, label: 'New' },
    open: { variant: 'info' as const, label: 'Open' },
    in_progress: { variant: 'warning' as const, label: 'In Progress' },
    pending: { variant: 'default' as const, label: 'Pending' },
    resolved: { variant: 'success' as const, label: 'Resolved' },
    closed: { variant: 'default' as const, label: 'Closed' },
  }

  const { variant, label } = statusMap[status]
  return <Badge variant={variant}>{label}</Badge>
}
