import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { documentId } = await req.json()

    if (!documentId) {
      throw new Error('Document ID is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get document from database
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError) throw docError
    if (!doc) throw new Error('Document not found')

    // Update status to processing
    await supabase
      .from('documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId)

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.file_path)

    if (downloadError) throw downloadError

    // Extract text based on file type
    let extractedText = ''
    let totalPages = 0

    if (doc.file_type === 'txt' || doc.file_type === 'md') {
      extractedText = await fileData.text()
      totalPages = 1
    } else if (doc.file_type === 'pdf') {
      // For PDF, we'd use a PDF parsing library
      // This is a simplified version - in production, use pdf-parse or similar
      extractedText = await fileData.text()
      totalPages = Math.ceil(extractedText.length / 3000) // Rough estimate
    } else if (doc.file_type === 'docx') {
      // For DOCX, we'd use mammoth or similar
      // This is a simplified version
      extractedText = await fileData.text()
      totalPages = 1
    }

    if (!extractedText || extractedText.length < 10) {
      throw new Error('Could not extract text from document')
    }

    // Chunk text with overlap for context preservation
    const chunks = chunkText(extractedText, {
      maxChars: 2000,
      overlap: 200,
    })

    console.log(`Processing ${chunks.length} chunks for document ${documentId}`)

    // Generate embeddings for each chunk and store
    let chunkIndex = 0
    for (const chunk of chunks) {
      // Generate embedding via OpenAI
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: chunk.content,
          model: 'text-embedding-3-small',
        }),
      })

      if (!embeddingResponse.ok) {
        const error = await embeddingResponse.text()
        throw new Error(`OpenAI API error: ${error}`)
      }

      const embeddingData = await embeddingResponse.json()
      const embedding = embeddingData.data[0].embedding

      // Insert chunk with embedding
      const { error: insertError } = await supabase.from('document_chunks').insert({
        document_id: documentId,
        chunk_index: chunkIndex,
        content: chunk.content,
        embedding: embedding,
        page_number: chunk.pageNumber,
        section_title: chunk.sectionTitle,
        chunk_metadata: {
          char_start: chunk.charStart,
          char_end: chunk.charEnd,
        },
        token_count: Math.ceil(chunk.content.length / 4), // Rough estimate
      })

      if (insertError) {
        console.error(`Error inserting chunk ${chunkIndex}:`, insertError)
      }

      chunkIndex++

      // Rate limiting - avoid hitting OpenAI rate limits
      if (chunkIndex % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // Update document as completed
    await supabase
      .from('documents')
      .update({
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
        total_pages: totalPages,
        total_chunks: chunks.length,
      })
      .eq('id', documentId)

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        chunks: chunks.length,
        message: 'Document processed successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Processing error:', error)

    // Try to update document as failed
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      const { documentId } = await req.clone().json().catch(() => ({}))
      if (documentId) {
        await supabase
          .from('documents')
          .update({
            processing_status: 'failed',
            processing_error: error.message,
          })
          .eq('id', documentId)
      }
    } catch (e) {
      console.error('Failed to update document status:', e)
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

interface ChunkOptions {
  maxChars: number
  overlap: number
}

interface Chunk {
  content: string
  pageNumber: number
  sectionTitle: string | null
  charStart: number
  charEnd: number
}

function chunkText(text: string, options: ChunkOptions): Chunk[] {
  const { maxChars, overlap } = options
  const chunks: Chunk[] = []

  // Split into paragraphs first
  const paragraphs = text.split(/\n\n+/)
  let currentChunk = ''
  let currentStart = 0
  let charPosition = 0
  let currentSection: string | null = null
  let pageNumber = 1

  for (const paragraph of paragraphs) {
    // Detect section headers (heuristic: short lines, possibly uppercase)
    if (paragraph.length < 100 && paragraph.trim().match(/^[A-Z0-9\s\-:\.]+$/)) {
      currentSection = paragraph.trim()
    }

    // Check if adding this paragraph exceeds max chars
    if (currentChunk.length + paragraph.length > maxChars && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        pageNumber,
        sectionTitle: currentSection,
        charStart: currentStart,
        charEnd: charPosition,
      })

      // Start new chunk with overlap
      const overlapText = currentChunk.slice(-overlap)
      currentChunk = overlapText + '\n\n' + paragraph
      currentStart = charPosition - overlap
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }

    charPosition += paragraph.length + 2 // Account for \n\n

    // Rough page number estimation (3000 chars per page)
    pageNumber = Math.ceil(charPosition / 3000)
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      pageNumber,
      sectionTitle: currentSection,
      charStart: currentStart,
      charEnd: charPosition,
    })
  }

  return chunks
}
