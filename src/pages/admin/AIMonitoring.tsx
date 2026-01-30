import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  XCircle,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { formatRelativeTime } from '@/lib/utils'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
interface AIGuardrailLog {
  id: string
  session_id: string
  user_id: string | null
  user_query: string
  ai_response: string | null
  guardrail_checks: Record<string, unknown>
  sources_used: unknown[] | null
  confidence_score: number | null
  hallucination_detected: boolean
  blocked_response: boolean
  fallback_message: string | null
  processing_time_ms: number | null
  created_at: string
}

interface Stats {
  totalInteractions: number
  blockedResponses: number
  avgConfidence: number
  hallucinationsDetected: number
}

const COLORS = ['#22c55e', '#ef4444', '#eab308']

export function AIMonitoring() {
  const [logs, setLogs] = useState<AIGuardrailLog[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [confidenceData, setConfidenceData] = useState<{ time: string; confidence: number }[]>([])
  const [outcomeData, setOutcomeData] = useState<{ name: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    // Fetch recent logs
    const { data: logsData } = await supabase
      .from('ai_guardrails_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (logsData) {
      setLogs(logsData)

      // Calculate stats
      const total = logsData.length
      const blocked = logsData.filter((l) => l.blocked_response).length
      const hallucinations = logsData.filter((l) => l.hallucination_detected).length
      const avgConf =
        logsData.reduce((sum, l) => sum + (l.confidence_score || 0), 0) / total || 0

      setStats({
        totalInteractions: total,
        blockedResponses: blocked,
        avgConfidence: avgConf,
        hallucinationsDetected: hallucinations,
      })

      // Confidence over time (last 10 entries)
      const last10 = logsData.slice(0, 10).reverse()
      setConfidenceData(
        last10.map((l) => ({
          time: formatRelativeTime(l.created_at),
          confidence: Math.round((l.confidence_score || 0) * 100),
        }))
      )

      // Outcome distribution
      const successful = total - blocked
      setOutcomeData([
        { name: 'Successful', value: successful },
        { name: 'Blocked', value: blocked },
        { name: 'Warnings', value: logsData.filter((l) => l.guardrail_checks && !l.blocked_response).length },
      ])
    }

    setLoading(false)
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Monitoring</h1>
        <p className="text-gray-600">Track AI interactions and guardrail performance</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Interactions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.totalInteractions || 0}
                </p>
              </div>
              <Activity className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Confidence</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round((stats?.avgConfidence || 0) * 100)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Blocked Responses</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats?.blockedResponses || 0}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Hallucinations</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats?.hallucinationsDetected || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence over time */}
        <Card>
          <CardHeader>
            <CardTitle>Confidence Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={confidenceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="confidence"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Response outcomes */}
        <Card>
          <CardHeader>
            <CardTitle>Response Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {outcomeData.map((_, index) => (
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

      {/* Recent interactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Interactions</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-y border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Query
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sources
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900 max-w-xs truncate">
                      {log.user_query}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-16 rounded-full bg-gray-200 overflow-hidden`}
                      >
                        <div
                          className={`h-full ${
                            (log.confidence_score || 0) >= 0.8
                              ? 'bg-green-500'
                              : (log.confidence_score || 0) >= 0.6
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${(log.confidence_score || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">
                        {Math.round((log.confidence_score || 0) * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {log.blocked_response ? (
                      <Badge variant="danger">Blocked</Badge>
                    ) : log.hallucination_detected ? (
                      <Badge variant="warning">Warning</Badge>
                    ) : (
                      <Badge variant="success">Success</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {Array.isArray(log.sources_used)
                      ? log.sources_used.length
                      : 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatRelativeTime(log.created_at)}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No AI interactions recorded yet
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
