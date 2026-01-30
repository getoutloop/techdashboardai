import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileText, Trash2, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Badge } from '@/components/shared/Badge'
import { Modal, ModalFooter } from '@/components/shared/Modal'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { formatDateTime, formatFileSize } from '@/lib/utils'

interface Document {
  id: string
  title: string
  description: string | null
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  file_hash: string
  category: string
  product_name: string | null
  product_version: string | null
  manufacturer: string | null
  model_number: string | null
  tags: string[] | null
  uploaded_by: string | null
  processing_status: string
  processing_error: string | null
  total_pages: number | null
  total_chunks: number
  metadata: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
  processed_at: string | null
}

export function DocumentLibrary() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; doc: Document | null }>({
    open: false,
    doc: null,
  })
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchDocuments()
  }, [])

  async function fetchDocuments() {
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setDocuments(data as Document[])
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!deleteModal.doc) return

    setDeleting(true)
    const { error } = await supabase
      .from('documents')
      .update({ is_active: false })
      .eq('id', deleteModal.doc.id)

    if (!error) {
      setDocuments((prev) => prev.filter((d) => d.id !== deleteModal.doc?.id))
      setDeleteModal({ open: false, doc: null })
    }
    setDeleting(false)
  }

  async function reprocessDocument(docId: string) {
    await supabase
      .from('documents')
      .update({ processing_status: 'pending' })
      .eq('id', docId)

    await supabase.functions.invoke('process-document', {
      body: { documentId: docId },
    })

    fetchDocuments()
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
      pending: 'default',
      processing: 'warning',
      completed: 'success',
      failed: 'danger',
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  function getCategoryLabel(category: string) {
    const labels: Record<string, string> = {
      user_manual: 'User Manual',
      service_manual: 'Service Manual',
      technical_doc: 'Technical Doc',
      policy: 'Policy',
      other: 'Other',
    }
    return labels[category] || category
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Library</h1>
          <p className="text-gray-600">Manage uploaded documents for AI reference</p>
        </div>
        <Link to="/admin/documents/upload">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Total Documents</p>
            <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Processed</p>
            <p className="text-2xl font-bold text-green-600">
              {documents.filter((d) => d.processing_status === 'completed').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Processing</p>
            <p className="text-2xl font-bold text-yellow-600">
              {documents.filter((d) => d.processing_status === 'processing').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Total Chunks</p>
            <p className="text-2xl font-bold text-gray-900">
              {documents.reduce((sum, d) => sum + (d.total_chunks || 0), 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Documents table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : documents.length === 0 ? (
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
            <p className="text-gray-500 mb-4">
              Upload your first document to get started with AI-powered search.
            </p>
            <Link to="/admin/documents/upload">
              <Button>Upload Document</Button>
            </Link>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chunks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <FileText className="h-5 w-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{doc.title}</p>
                          <p className="text-sm text-gray-500">{doc.file_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {getCategoryLabel(doc.category)}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(doc.processing_status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {doc.total_chunks || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDateTime(doc.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {doc.processing_status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => reprocessDocument(doc.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteModal({ open: true, doc })}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, doc: null })}
        title="Delete Document"
      >
        <p className="text-gray-600">
          Are you sure you want to delete "{deleteModal.doc?.title}"? This will also
          remove all associated chunks and embeddings.
        </p>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => setDeleteModal({ open: false, doc: null })}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
