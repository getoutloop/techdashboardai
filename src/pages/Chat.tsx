import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, AlertCircle, ExternalLink } from 'lucide-react'
import { Card } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/shared/AuthProvider'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: {
    index: number
    content: string
    documentId: string
    similarity: number
  }[]
  confidence?: number
  guardrailTriggered?: string
  timestamp: Date
}

export function Chat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Call the chat-with-guardrails edge function
      const { data, error } = await supabase.functions.invoke('chat-with-guardrails', {
        body: {
          query: input,
          sessionId: crypto.randomUUID(),
          userId: user?.id,
        },
      })

      if (error) throw error

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        sources: data.sources,
        confidence: data.confidence,
        guardrailTriggered: data.guardrailTriggered,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  function getConfidenceColor(confidence: number) {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">AI Support Chat</h1>
        <p className="text-gray-600">
          Ask questions about our products and services
        </p>
      </div>

      {/* Chat container */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                How can I help you today?
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                I can answer questions based on our documentation. All responses
                are sourced from verified documents to ensure accuracy.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="h-8 w-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5" />
                </div>
              )}

              <div
                className={cn(
                  'max-w-[70%] rounded-lg p-4',
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* Confidence indicator */}
                {message.confidence !== undefined && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className={cn('text-xs', getConfidenceColor(message.confidence))}>
                      Confidence: {Math.round(message.confidence * 100)}%
                    </p>
                  </div>
                )}

                {/* Guardrail warning */}
                {message.guardrailTriggered && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs">
                      {message.guardrailTriggered === 'low_confidence'
                        ? 'Low confidence response'
                        : 'Response may need verification'}
                    </span>
                  </div>
                )}

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      Sources:
                    </p>
                    <div className="space-y-1">
                      {message.sources.map((source) => (
                        <div
                          key={source.index}
                          className="text-xs text-gray-600 flex items-start gap-1"
                        >
                          <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{source.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="h-8 w-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="h-5 w-5" />
              </div>
              <div className="bg-gray-100 rounded-lg p-4">
                <LoadingSpinner size="sm" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
            />
            <Button type="submit" disabled={!input.trim() || loading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            Responses are generated from verified documentation. Always verify
            critical information.
          </p>
        </div>
      </Card>
    </div>
  )
}
