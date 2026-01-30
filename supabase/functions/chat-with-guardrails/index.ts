import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GuardrailConfig {
  confidenceThreshold: number
  minSources: number
  maxTokens: number
  blockUnsupported: boolean
  citationRequired: boolean
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const { query, sessionId, userId } = await req.json()

    if (!query) {
      throw new Error('Query is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    // STEP 1: Load guardrail configuration
    const { data: guardrailsData } = await supabase
      .from('ai_guardrails_config')
      .select('*')
      .eq('is_enabled', true)

    const config: GuardrailConfig = {
      confidenceThreshold: guardrailsData?.find(g => g.rule_name === 'min_confidence')?.rule_value?.threshold || 0.7,
      minSources: guardrailsData?.find(g => g.rule_name === 'require_sources')?.rule_value?.min_sources || 1,
      maxTokens: guardrailsData?.find(g => g.rule_name === 'max_response_length')?.rule_value?.max_tokens || 1000,
      blockUnsupported: guardrailsData?.find(g => g.rule_name === 'block_unsupported')?.rule_value?.enabled ?? true,
      citationRequired: guardrailsData?.find(g => g.rule_name === 'citation_required')?.rule_value?.required ?? true,
    }

    // STEP 2: Generate embedding for user query
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: query,
        model: 'text-embedding-3-small',
      }),
    })

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate query embedding')
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.data[0].embedding

    // STEP 3: Vector search for relevant document chunks
    const { data: relevantChunks, error: searchError } = await supabase.rpc(
      'search_document_chunks',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.6, // Lower threshold for initial retrieval
        match_count: 5,
      }
    )

    if (searchError) {
      console.error('Search error:', searchError)
    }

    // STEP 4: Check guardrail #1 - Minimum sources required
    if (!relevantChunks || relevantChunks.length < config.minSources) {
      const fallbackMessage = "I don't have enough information in the documentation to answer that question accurately. Could you please rephrase your question or ask about a different topic?"

      await logInteraction(supabase, {
        sessionId,
        userId,
        userQuery: query,
        aiResponse: null,
        guardrailChecks: {
          sources_found: relevantChunks?.length || 0,
          min_sources_required: config.minSources,
          check_passed: false,
          reason: 'insufficient_sources',
        },
        sourcesUsed: [],
        confidenceScore: 0,
        blockedResponse: true,
        fallbackMessage,
        processingTimeMs: Date.now() - startTime,
      })

      return new Response(
        JSON.stringify({
          response: fallbackMessage,
          blocked: true,
          reason: 'insufficient_sources',
          confidence: 0,
          sources: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STEP 5: Build context from retrieved chunks
    const contextParts = relevantChunks.map((chunk: any, idx: number) => {
      return `[Source ${idx + 1}: ${chunk.document_title}${chunk.section_title ? ' - ' + chunk.section_title : ''}]\n${chunk.content}`
    })

    const context = contextParts.join('\n\n---\n\n')

    // STEP 6: Generate AI response with strict instructions
    const systemPrompt = `You are a helpful technical support assistant. Your role is to answer questions using ONLY the information from the provided documentation sources.

CRITICAL RULES:
1. ONLY use information from the provided sources below - do not make up or infer information
2. ALWAYS cite your sources using [Source N] notation for every fact or statement
3. If the sources don't contain the answer, say "The documentation doesn't cover this specific topic"
4. Be concise, accurate, and helpful
5. If you're uncertain, express that uncertainty clearly
6. Never provide medical, legal, or financial advice

DOCUMENTATION SOURCES:
${context}

Remember: Every factual statement must have a citation like [Source 1] or [Source 2].`

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        max_tokens: config.maxTokens,
        temperature: 0.3, // Low temperature for factual accuracy
      }),
    })

    if (!chatResponse.ok) {
      throw new Error('Failed to generate AI response')
    }

    const chatData = await chatResponse.json()
    const aiResponse = chatData.choices[0].message.content

    // STEP 7: Check guardrail #2 - Citation verification
    const citationPattern = /\[Source (\d+)\]/g
    const citations = [...aiResponse.matchAll(citationPattern)]
    const citedSourceIndices = [...new Set(citations.map((m: any) => parseInt(m[1]) - 1))]
      .filter((i: number) => i >= 0 && i < relevantChunks.length)

    if (config.citationRequired && citations.length === 0) {
      // Response has no citations - this might indicate hallucination
      const fallbackMessage = "I couldn't provide a properly sourced answer to your question. Please try rephrasing or ask about a different topic."

      await logInteraction(supabase, {
        sessionId,
        userId,
        userQuery: query,
        aiResponse,
        guardrailChecks: {
          sources_found: relevantChunks.length,
          citations_in_response: 0,
          citation_required: true,
          check_passed: false,
          reason: 'no_citations',
        },
        sourcesUsed: [],
        confidenceScore: 0,
        blockedResponse: true,
        fallbackMessage,
        hallucinationDetected: true,
        processingTimeMs: Date.now() - startTime,
      })

      return new Response(
        JSON.stringify({
          response: fallbackMessage,
          blocked: true,
          reason: 'no_citations',
          confidence: 0,
          sources: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STEP 8: Calculate confidence score
    const avgSimilarity = relevantChunks.reduce((sum: number, c: any) => sum + c.similarity, 0) / relevantChunks.length
    const citationCoverage = Math.min(citedSourceIndices.length / relevantChunks.length, 1)
    const responseQuality = aiResponse.length > 50 && aiResponse.length < 3000 ? 1 : 0.7

    // Weighted confidence: 50% similarity, 30% citation coverage, 20% response quality
    const confidenceScore = (avgSimilarity * 0.5) + (citationCoverage * 0.3) + (responseQuality * 0.2)

    // STEP 9: Check guardrail #3 - Minimum confidence
    let finalResponse = aiResponse
    let guardrailTriggered: string | null = null

    if (confidenceScore < config.confidenceThreshold) {
      if (config.blockUnsupported) {
        const fallbackMessage = "I'm not confident enough in my answer based on the available documentation. Would you like me to connect you with a human support agent?"

        await logInteraction(supabase, {
          sessionId,
          userId,
          userQuery: query,
          aiResponse,
          guardrailChecks: {
            confidence_score: confidenceScore,
            min_confidence: config.confidenceThreshold,
            check_passed: false,
            reason: 'low_confidence',
          },
          sourcesUsed: relevantChunks.map((c: any) => ({ document_id: c.document_id, similarity: c.similarity })),
          confidenceScore,
          blockedResponse: true,
          fallbackMessage,
          processingTimeMs: Date.now() - startTime,
        })

        return new Response(
          JSON.stringify({
            response: fallbackMessage,
            blocked: true,
            reason: 'low_confidence',
            confidence: confidenceScore,
            sources: [],
            suggestAgent: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        // Add warning but don't block
        finalResponse += "\n\n⚠️ *Note: This response has lower confidence. Please verify with official documentation or contact support if needed.*"
        guardrailTriggered = 'low_confidence_warning'
      }
    }

    // STEP 10: All checks passed - log and return response
    const sourcesUsed = relevantChunks.map((chunk: any, idx: number) => ({
      index: idx + 1,
      documentId: chunk.document_id,
      documentTitle: chunk.document_title,
      sectionTitle: chunk.section_title,
      content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
      similarity: chunk.similarity,
      cited: citedSourceIndices.includes(idx),
    }))

    await logInteraction(supabase, {
      sessionId,
      userId,
      userQuery: query,
      aiResponse: finalResponse,
      guardrailChecks: {
        confidence_score: confidenceScore,
        sources_found: relevantChunks.length,
        citations_in_response: citations.length,
        all_checks_passed: true,
        guardrail_triggered: guardrailTriggered,
      },
      sourcesUsed,
      confidenceScore,
      blockedResponse: false,
      processingTimeMs: Date.now() - startTime,
    })

    // Log document access for analytics
    for (const chunk of relevantChunks) {
      await supabase.from('document_access_logs').insert({
        document_id: chunk.document_id,
        user_id: userId,
        access_type: 'ai_reference',
      })
    }

    return new Response(
      JSON.stringify({
        response: finalResponse,
        blocked: false,
        confidence: confidenceScore,
        sources: sourcesUsed,
        guardrailTriggered,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Chat error:', error)

    return new Response(
      JSON.stringify({
        error: error.message,
        response: "I'm sorry, I encountered an error processing your request. Please try again.",
        blocked: true,
        reason: 'error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

interface LogData {
  sessionId: string
  userId?: string
  userQuery: string
  aiResponse: string | null
  guardrailChecks: Record<string, any>
  sourcesUsed: any[]
  confidenceScore: number
  blockedResponse: boolean
  fallbackMessage?: string
  hallucinationDetected?: boolean
  processingTimeMs: number
}

async function logInteraction(supabase: any, data: LogData) {
  try {
    await supabase.from('ai_guardrails_logs').insert({
      session_id: data.sessionId,
      user_id: data.userId || null,
      user_query: data.userQuery,
      ai_response: data.aiResponse,
      guardrail_checks: data.guardrailChecks,
      sources_used: data.sourcesUsed,
      confidence_score: data.confidenceScore,
      hallucination_detected: data.hallucinationDetected || false,
      blocked_response: data.blockedResponse,
      fallback_message: data.fallbackMessage || null,
      processing_time_ms: data.processingTimeMs,
    })
  } catch (error) {
    console.error('Failed to log interaction:', error)
  }
}
