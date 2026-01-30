import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PriorityBadge } from '@/components/shared/Badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { formatRelativeTime, cn } from '@/lib/utils'
import type { Ticket, TicketStatus } from '@/types/database.types'

const columns: { id: TicketStatus; title: string; color: string }[] = [
  { id: 'new', title: 'New', color: 'bg-purple-500' },
  { id: 'open', title: 'Open', color: 'bg-blue-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-yellow-500' },
  { id: 'pending', title: 'Pending', color: 'bg-orange-500' },
  { id: 'resolved', title: 'Resolved', color: 'bg-green-500' },
]

interface TicketCardProps {
  ticket: Ticket
  isDragging?: boolean
}

function TicketCard({ ticket, isDragging }: TicketCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-4 shadow-sm',
        isDragging && 'shadow-lg opacity-90'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <Link
          to={`/tickets/${ticket.id}`}
          className="text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          {ticket.ticket_number}
        </Link>
        <PriorityBadge priority={ticket.priority} />
      </div>
      <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
        {ticket.title}
      </p>
      <p className="text-xs text-gray-500">{formatRelativeTime(ticket.created_at)}</p>
    </div>
  )
}

function SortableTicketCard({ ticket }: { ticket: Ticket }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn('cursor-grab', isDragging && 'cursor-grabbing')}
    >
      <TicketCard ticket={ticket} isDragging={isDragging} />
    </div>
  )
}

interface ColumnProps {
  column: { id: TicketStatus; title: string; color: string }
  tickets: Ticket[]
}

function Column({ column, tickets }: ColumnProps) {
  return (
    <div className="flex-shrink-0 w-72">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('h-3 w-3 rounded-full', column.color)} />
        <h3 className="font-semibold text-gray-900">{column.title}</h3>
        <span className="ml-auto bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
          {tickets.length}
        </span>
      </div>
      <div className="bg-gray-50 rounded-lg p-2 min-h-[500px]">
        <SortableContext
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <SortableTicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </SortableContext>
        {tickets.length === 0 && (
          <div className="flex items-center justify-center h-24 text-sm text-gray-400">
            No tickets
          </div>
        )}
      </div>
    </div>
  )
}

export function Kanban() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  useEffect(() => {
    fetchTickets()
  }, [])

  async function fetchTickets() {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .in('status', columns.map((c) => c.id))
      .order('updated_at', { ascending: false })

    if (!error && data) {
      setTickets(data)
    }
    setLoading(false)
  }

  function handleDragStart(event: DragStartEvent) {
    const ticket = tickets.find((t) => t.id === event.active.id)
    setActiveTicket(ticket || null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTicket(null)

    if (!over) return

    const ticketId = active.id as string
    const overTicketId = over.id as string

    // Find the target column
    const overTicket = tickets.find((t) => t.id === overTicketId)
    const overColumn = overTicket?.status || (columns.find((c) => c.id === overTicketId)?.id as TicketStatus)

    if (!overColumn) return

    const ticket = tickets.find((t) => t.id === ticketId)
    if (!ticket || ticket.status === overColumn) return

    // Optimistically update UI
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId ? { ...t, status: overColumn } : t
      )
    )

    // Update in database
    const { error } = await supabase
      .from('tickets')
      .update({ status: overColumn, updated_at: new Date().toISOString() })
      .eq('id', ticketId)

    if (error) {
      // Revert on error
      fetchTickets()
    }
  }

  const getTicketsByStatus = (status: TicketStatus) =>
    tickets.filter((t) => t.status === status)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kanban Board</h1>
        <p className="text-gray-600">Drag and drop tickets to update their status</p>
      </div>

      {/* Board */}
      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max">
            {columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                tickets={getTicketsByStatus(column.id)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTicket && <TicketCard ticket={activeTicket} isDragging />}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
