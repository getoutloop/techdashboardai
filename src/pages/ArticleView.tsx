import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ThumbsUp, ThumbsDown, Edit, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Badge } from '@/components/shared/Badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/shared/AuthProvider'
import { formatDateTime } from '@/lib/utils'
import type { KBArticle } from '@/types/database.types'

export function ArticleView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAgent } = useAuth()

  const [article, setArticle] = useState<KBArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (id) {
      fetchArticle()
      incrementViewCount()
    }
  }, [id])

  async function fetchArticle() {
    const { data, error } = await supabase
      .from('knowledge_base_articles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching article:', error)
      navigate('/knowledge-base')
    } else {
      setArticle(data)
    }
    setLoading(false)
  }

  async function incrementViewCount() {
    await supabase.rpc('increment_article_views', { article_id: id })
  }

  async function handleVote(helpful: boolean) {
    if (voted) return

    if (helpful) {
      await supabase
        .from('knowledge_base_articles')
        .update({ helpful_count: (article?.helpful_count || 0) + 1 })
        .eq('id', id)
      setVoted('up')
      setArticle((prev) =>
        prev ? { ...prev, helpful_count: prev.helpful_count + 1 } : null
      )
    } else {
      setVoted('down')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Article not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/knowledge-base')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Knowledge Base
        </Button>
        {isAgent && (
          <Link to={`/knowledge-base/${id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        )}
      </div>

      {/* Article */}
      <Card>
        <CardContent className="py-8">
          {/* Meta */}
          <div className="flex items-center gap-3 mb-4">
            {article.category && (
              <Badge variant="primary">{article.category}</Badge>
            )}
            {!article.published && isAgent && (
              <Badge variant="warning">Draft</Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {article.title}
          </h1>

          {/* Info */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 pb-8 border-b border-gray-200">
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {article.view_count} views
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-4 w-4" />
              {article.helpful_count} found helpful
            </span>
            <span>Last updated: {formatDateTime(article.updated_at)}</span>
          </div>

          {/* Content */}
          <div
            className="prose prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Tags:</p>
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-md"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-900 mb-4">
              Was this article helpful?
            </p>
            <div className="flex gap-3">
              <Button
                variant={voted === 'up' ? 'primary' : 'outline'}
                onClick={() => handleVote(true)}
                disabled={voted !== null}
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Yes
              </Button>
              <Button
                variant={voted === 'down' ? 'secondary' : 'outline'}
                onClick={() => handleVote(false)}
                disabled={voted !== null}
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                No
              </Button>
            </div>
            {voted && (
              <p className="text-sm text-gray-500 mt-3">
                Thank you for your feedback!
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
