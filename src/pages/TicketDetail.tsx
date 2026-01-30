import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Select } from '@/components/shared/Select'
import { Textarea } from '@/components/shared/Textarea'
import { StatusBadge, PriorityBadge } from '@/components/shared/Badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/shared/AuthProvider'
import { formatDateTime, getInitials } from '@/lib/utils'
import type { Ticket, TicketMessage, TicketStatus, TicketPriority } from '@/types/database.types'

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAgent } = useAuth()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<(TicketMessage & { user?: { full_name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (id) {
      fetchTicket()
      fetchMessages()
      subscribeToMessages()
    }
  }, [id])

  async function fetchTicket() {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching ticket:', error)
      navigate('/tickets')
    } else {
      setTicket(data)
    }
    setLoading(false)
  }

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('ticket_messages')
      .select(`
        *,
        user:users(full_name)
      `)
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setMessages(data)
    }
  }

  function subscribeToMessages() {
    const channel = supabase
      .channel(`ticket-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${id}`,
        },
        () => {
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !user) return

    setSending(true)
    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: id,
      user_id: user.id,
      message: newMessage,
      is_internal_note: false,
      is_ai_generated: false,
    })

    if (!error) {
      setNewMessage('')
    }
    setSending(false)
  }

  async function updateTicketStatus(status: string) {
    const { error } = await supabase
      .from('tickets')
      .update({ status: status as TicketStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setTicket((prev) => prev ? { ...prev, status: status as TicketStatus } : null)
    }
  }

  async function updateTicketPriority(priority: string) {
    const { error } = await supabase
      .from('tickets')
      .update({ priority: priority as TicketPriority, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setTicket((prev) => prev ? { ...prev, priority: priority as TicketPriority } : null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Ticket not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/tickets')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{ticket.ticket_number}</h1>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <p className="text-gray-600 mt-1">{ticket.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No messages yet</p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="flex gap-3">
                    <div className="h-8 w-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium">
                        {message.user?.full_name ? getInitials(message.user.full_name) : 'U'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {message.user?.full_name || 'Unknown User'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDateTime(message.created_at)}
                        </span>
                        {message.is_ai_generated && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            AI
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 mt-1 whitespace-pre-wrap">{message.message}</p>
                    </div>
                  </div>
                ))
              )}

              {/* Reply form */}
              <form onSubmit={handleSendMessage} className="pt-4 border-t border-gray-200">
                <Textarea
                  placeholder="Type your reply..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[80px]"
                />
                <div className="flex justify-end mt-2">
                  <Button type="submit" loading={sending} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Reply
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAgent && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <Select
                      options={statusOptions}
                      value={ticket.status}
                      onChange={(e) => updateTicketStatus(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <Select
                      options={priorityOptions}
                      value={ticket.priority}
                      onChange={(e) => updateTicketPriority(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <p className="text-gray-900">{ticket.category || 'Not specified'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Created
                </label>
                <p className="text-gray-900">{formatDateTime(ticket.created_at)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Updated
                </label>
                <p className="text-gray-900">{formatDateTime(ticket.updated_at)}</p>
              </div>

              {ticket.sla_due_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SLA Due Date
                  </label>
                  <p className={`${ticket.sla_breached ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                    {formatDateTime(ticket.sla_due_date)}
                    {ticket.sla_breached && ' (Breached)'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
