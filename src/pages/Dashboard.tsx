import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Ticket,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { formatRelativeTime, formatStatus, getPriorityColor } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import type { Ticket as TicketType } from '@/types/database.types'

interface DashboardStats {
  openTickets: number
  pendingTickets: number
  resolvedToday: number
  avgResponseTime: number
  openChange: number
  resolvedChange: number
}

const COLORS = ['#3b82f6', '#eab308', '#22c55e', '#ef4444', '#8b5cf6', '#6b7280']

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentTickets, setRecentTickets] = useState<TicketType[]>([])
  const [ticketsByStatus, setTicketsByStatus] = useState<{ name: string; value: number }[]>([])
  const [ticketsByDay, setTicketsByDay] = useState<{ day: string; tickets: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      // Fetch ticket counts
      const [openRes, pendingRes, resolvedRes, recentRes] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact' }).eq('status', 'open'),
        supabase.from('tickets').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('tickets').select('id', { count: 'exact' })
          .eq('status', 'resolved')
          .gte('updated_at', new Date().toISOString().split('T')[0]),
        supabase.from('tickets')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      // Fetch tickets by status for pie chart
      const { data: allTickets } = await supabase.from('tickets').select('status')

      const statusCounts = allTickets?.reduce((acc, ticket) => {
        acc[ticket.status] = (acc[ticket.status] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      const statusData = Object.entries(statusCounts).map(([name, value]) => ({
        name: formatStatus(name),
        value,
      }))

      // Mock weekly data (in a real app, you'd query this from the database)
      const weeklyData = [
        { day: 'Mon', tickets: 12 },
        { day: 'Tue', tickets: 19 },
        { day: 'Wed', tickets: 15 },
        { day: 'Thu', tickets: 22 },
        { day: 'Fri', tickets: 18 },
        { day: 'Sat', tickets: 8 },
        { day: 'Sun', tickets: 5 },
      ]

      setStats({
        openTickets: openRes.count || 0,
        pendingTickets: pendingRes.count || 0,
        resolvedToday: resolvedRes.count || 0,
        avgResponseTime: 2.4, // Mock value - would be calculated from actual data
        openChange: 12, // Mock value
        resolvedChange: 8, // Mock value
      })

      setRecentTickets(recentRes.data || [])
      setTicketsByStatus(statusData)
      setTicketsByDay(weeklyData)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's an overview of your support tickets.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Open Tickets</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.openTickets}</p>
                <div className="flex items-center mt-2 text-sm">
                  {(stats?.openChange ?? 0) > 0 ? (
                    <>
                      <ArrowUpRight className="h-4 w-4 text-red-500" />
                      <span className="text-red-500">{stats?.openChange}%</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="h-4 w-4 text-green-500" />
                      <span className="text-green-500">{Math.abs(stats?.openChange ?? 0)}%</span>
                    </>
                  )}
                  <span className="text-gray-500 ml-1">vs last week</span>
                </div>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Ticket className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.pendingTickets}</p>
                <div className="flex items-center mt-2 text-sm">
                  <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                  <span className="text-gray-500">Awaiting response</span>
                </div>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resolved Today</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.resolvedToday}</p>
                <div className="flex items-center mt-2 text-sm">
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">{stats?.resolvedChange}%</span>
                  <span className="text-gray-500 ml-1">vs yesterday</span>
                </div>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Response Time</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.avgResponseTime}h</p>
                <div className="flex items-center mt-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-gray-500">On target</span>
                </div>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly tickets chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ticketsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tickets by status pie chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ticketsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  >
                    {ticketsByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent tickets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Tickets</CardTitle>
          <Link to="/tickets" className="text-sm text-primary-600 hover:text-primary-700">
            View all
          </Link>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-y border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticket
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-primary-600"
                    >
                      {ticket.ticket_number}
                    </Link>
                    <p className="text-sm text-gray-500 truncate max-w-xs">{ticket.title}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        ticket.status === 'resolved'
                          ? 'success'
                          : ticket.status === 'in_progress'
                          ? 'warning'
                          : 'info'
                      }
                    >
                      {formatStatus(ticket.status)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatRelativeTime(ticket.created_at)}
                  </td>
                </tr>
              ))}
              {recentTickets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No tickets found. Create your first ticket to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
