import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { Select } from '@/components/shared/Select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/shared/AuthProvider'
import { formatFileSize, cn } from '@/lib/utils'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const categoryOptions = [
  { value: 'user_manual', label: 'User Manual' },
  { value: 'service_manual', label: 'Service Manual' },
  { value: 'technical_doc', label: 'Technical Document' },
  { value: 'policy', label: 'Policy' },
  { value: 'other', label: 'Other' },
]

interface UploadFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
  progress: number
  title: string
  category: string
  productName: string
}

export function DocumentUpload() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles
      .filter((file) => {
        if (!ALLOWED_TYPES.includes(file.type)) {
          console.warn(`Invalid file type: ${file.name}`)
          return false
        }
        if (file.size > MAX_FILE_SIZE) {
          console.warn(`File too large: ${file.name}`)
          return false
        }
        return true
      })
      .map((file) => ({
        file,
        id: crypto.randomUUID(),
        status: 'pending',
        progress: 0,
        title: file.name.replace(/\.[^/.]+$/, ''),
        category: 'user_manual',
        productName: '',
      }))

    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  })

  function updateFile(id: string, updates: Partial<UploadFile>) {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    )
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  async function uploadFiles() {
    setUploading(true)

    for (const fileData of files.filter((f) => f.status === 'pending')) {
      try {
        updateFile(fileData.id, { status: 'uploading', progress: 10 })

        // Calculate file hash
        const buffer = await fileData.file.arrayBuffer()
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const fileHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

        updateFile(fileData.id, { progress: 30 })

        // Check for duplicates
        const { data: existingDoc } = await supabase
          .from('documents')
          .select('id, title')
          .eq('file_hash', fileHash)
          .eq('is_active', true)
          .single()

        if (existingDoc) {
          const typedDoc = existingDoc as { id: string; title: string }
          updateFile(fileData.id, {
            status: 'error',
            error: `Duplicate file: "${typedDoc.title}" already exists`,
          })
          continue
        }

        updateFile(fileData.id, { progress: 50 })

        // Upload to storage
        const fileName = `${Date.now()}_${fileData.file.name}`
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, fileData.file)

        if (uploadError) throw uploadError

        updateFile(fileData.id, { progress: 70 })

        // Get file extension
        const fileType = fileData.file.name.split('.').pop()?.toLowerCase() || 'txt'

        // Create document record
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            title: fileData.title,
            file_name: fileData.file.name,
            file_path: fileName,
            file_type: fileType === 'docx' ? 'docx' : fileType,
            file_size: fileData.file.size,
            file_hash: fileHash,
            category: fileData.category,
            product_name: fileData.productName || null,
            uploaded_by: user?.id,
            processing_status: 'pending',
          } as Record<string, unknown>)
          .select()
          .single()

        if (docError) throw docError

        updateFile(fileData.id, { status: 'processing', progress: 85 })

        const typedDocData = docData as { id: string }

        // Trigger processing
        await supabase.functions.invoke('process-document', {
          body: { documentId: typedDocData.id },
        })

        updateFile(fileData.id, { status: 'completed', progress: 100 })
      } catch (error) {
        console.error('Upload error:', error)
        updateFile(fileData.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed',
        })
      }
    }

    setUploading(false)
  }

  const pendingFiles = files.filter((f) => f.status === 'pending')
  const hasCompleted = files.some((f) => f.status === 'completed')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Documents</h1>
        <p className="text-gray-600">
          Upload PDF, DOCX, TXT, or Markdown files for AI-powered search
        </p>
      </div>

      {/* Dropzone */}
      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            )}
          >
            <input {...getInputProps()} />
            <Upload
              className={cn(
                'h-12 w-12 mx-auto mb-4',
                isDragActive ? 'text-primary-600' : 'text-gray-400'
              )}
            />
            {isDragActive ? (
              <p className="text-lg font-medium text-primary-600">
                Drop files here...
              </p>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-900">
                  Drag & drop documents here
                </p>
                <p className="text-gray-500 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">
                  PDF, DOCX, TXT, MD - Max 50MB per file
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File list */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Files ({files.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((fileData) => (
              <div
                key={fileData.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-gray-900 truncate">
                        {fileData.file.name}
                      </p>
                      <span className="text-xs text-gray-500">
                        ({formatFileSize(fileData.file.size)})
                      </span>
                    </div>

                    {fileData.status === 'pending' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Input
                          placeholder="Document title"
                          value={fileData.title}
                          onChange={(e) =>
                            updateFile(fileData.id, { title: e.target.value })
                          }
                        />
                        <Select
                          options={categoryOptions}
                          value={fileData.category}
                          onChange={(e) =>
                            updateFile(fileData.id, { category: e.target.value })
                          }
                        />
                        <Input
                          placeholder="Product name (optional)"
                          value={fileData.productName}
                          onChange={(e) =>
                            updateFile(fileData.id, { productName: e.target.value })
                          }
                        />
                      </div>
                    )}

                    {(fileData.status === 'uploading' ||
                      fileData.status === 'processing') && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">
                            {fileData.status === 'uploading'
                              ? 'Uploading...'
                              : 'Processing...'}
                          </span>
                          <span className="text-gray-500">{fileData.progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-600 transition-all"
                            style={{ width: `${fileData.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {fileData.status === 'completed' && (
                      <div className="flex items-center gap-2 text-green-600 mt-2">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Upload complete</span>
                      </div>
                    )}

                    {fileData.status === 'error' && (
                      <div className="flex items-center gap-2 text-red-600 mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{fileData.error}</span>
                      </div>
                    )}
                  </div>

                  {fileData.status === 'pending' && (
                    <button
                      onClick={() => removeFile(fileData.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/admin/documents')}>
          {hasCompleted ? 'Back to Library' : 'Cancel'}
        </Button>
        {pendingFiles.length > 0 && (
          <Button onClick={uploadFiles} loading={uploading}>
            Upload {pendingFiles.length} File{pendingFiles.length > 1 ? 's' : ''}
          </Button>
        )}
      </div>
    </div>
  )
}
