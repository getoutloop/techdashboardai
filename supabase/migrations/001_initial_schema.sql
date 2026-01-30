-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- 1. USERS TABLE (extends auth.users)
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'agent', 'customer')),
  avatar_url TEXT,
  expertise_areas TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Trigger to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'customer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. TICKETS TABLE
-- ============================================
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq;

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'open', 'in_progress', 'pending', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT,
  tags TEXT[],
  customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sla_due_date TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Auto-generate ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'TICK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(NEXTVAL('ticket_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION generate_ticket_number();

-- RLS for tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own tickets" ON public.tickets
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Agents view all tickets" ON public.tickets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'admin'))
  );

CREATE POLICY "Customers can create tickets" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Agents can update tickets" ON public.tickets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'admin'))
  );

-- ============================================
-- 3. TICKET MESSAGES TABLE
-- ============================================
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT false,
  is_ai_generated BOOLEAN DEFAULT false,
  attachments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view messages of accessible tickets" ON public.ticket_messages
  FOR SELECT USING (
    ticket_id IN (SELECT id FROM public.tickets WHERE customer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'admin'))
  );

CREATE POLICY "Users can insert messages" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      ticket_id IN (SELECT id FROM public.tickets WHERE customer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'admin'))
    )
  );

-- ============================================
-- 4. KNOWLEDGE BASE ARTICLES TABLE
-- ============================================
CREATE TABLE public.knowledge_base_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT false,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector index for similarity search
CREATE INDEX idx_kb_articles_embedding ON public.knowledge_base_articles
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published articles viewable by all" ON public.knowledge_base_articles
  FOR SELECT USING (
    published = true
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'admin'))
  );

CREATE POLICY "Agents can manage articles" ON public.knowledge_base_articles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'admin'))
  );

-- Function to increment article views
CREATE OR REPLACE FUNCTION increment_article_views(article_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.knowledge_base_articles
  SET view_count = view_count + 1
  WHERE id = article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. DOCUMENTS TABLE (Admin-only)
-- ============================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'md')),
  file_size BIGINT NOT NULL,
  file_hash TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('user_manual', 'service_manual', 'technical_doc', 'policy', 'other')),
  product_name TEXT,
  product_version TEXT,
  manufacturer TEXT,
  model_number TEXT,
  tags TEXT[],
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  total_pages INTEGER,
  total_chunks INTEGER DEFAULT 0,
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_documents_category ON public.documents(category);
CREATE INDEX idx_documents_product ON public.documents(product_name, product_version);
CREATE INDEX idx_documents_active ON public.documents(is_active);
CREATE INDEX idx_documents_status ON public.documents(processing_status);

-- RLS: Admin-only access
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view documents" ON public.documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can insert documents" ON public.documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can update documents" ON public.documents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can delete documents" ON public.documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 6. DOCUMENT CHUNKS TABLE (For RAG)
-- ============================================
CREATE TABLE public.document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  page_number INTEGER,
  section_title TEXT,
  chunk_metadata JSONB,
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast vector search
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_document_chunks_document ON public.document_chunks(document_id);

-- ============================================
-- 7. DOCUMENT ACCESS LOGS TABLE
-- ============================================
CREATE TABLE public.document_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('view', 'download', 'search_result', 'ai_reference')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_access_logs_document ON public.document_access_logs(document_id);
CREATE INDEX idx_access_logs_user ON public.document_access_logs(user_id);

-- ============================================
-- 8. AI GUARDRAILS CONFIG TABLE
-- ============================================
CREATE TABLE public.ai_guardrails_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_name TEXT UNIQUE NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('confidence_threshold', 'source_requirement', 'content_filter', 'response_length')),
  rule_value JSONB NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default guardrails
INSERT INTO public.ai_guardrails_config (rule_name, rule_type, rule_value, description) VALUES
  ('min_confidence', 'confidence_threshold', '{"threshold": 0.7}', 'Minimum confidence score to show AI response'),
  ('require_sources', 'source_requirement', '{"min_sources": 1}', 'Require at least 1 document source'),
  ('max_response_length', 'response_length', '{"max_tokens": 1000}', 'Maximum AI response length'),
  ('block_unsupported', 'content_filter', '{"enabled": true}', 'Block responses without document support'),
  ('citation_required', 'source_requirement', '{"required": true}', 'Always show source citations');

-- ============================================
-- 9. AI GUARDRAILS LOGS TABLE
-- ============================================
CREATE TABLE public.ai_guardrails_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_query TEXT NOT NULL,
  ai_response TEXT,
  guardrail_checks JSONB NOT NULL,
  sources_used JSONB,
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
  hallucination_detected BOOLEAN DEFAULT false,
  inappropriate_content BOOLEAN DEFAULT false,
  blocked_response BOOLEAN DEFAULT false,
  fallback_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guardrails_session ON public.ai_guardrails_logs(session_id);
CREATE INDEX idx_guardrails_blocked ON public.ai_guardrails_logs(blocked_response);
CREATE INDEX idx_guardrails_hallucination ON public.ai_guardrails_logs(hallucination_detected);

-- ============================================
-- 10. AI CHAT SESSIONS TABLE
-- ============================================
CREATE TABLE public.ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::JSONB,
  context_used JSONB,
  total_tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own chat sessions" ON public.ai_chat_sessions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'admin'))
  );

CREATE POLICY "Users can create chat sessions" ON public.ai_chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions" ON public.ai_chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 11. TICKET EMBEDDINGS TABLE
-- ============================================
CREATE TABLE public.ticket_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_embeddings_vector ON public.ticket_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- 12. AUTOMATION LOGS TABLE
-- ============================================
CREATE TABLE public.automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  automation_type TEXT NOT NULL,
  input_data JSONB,
  output_data JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VECTOR SEARCH FUNCTIONS
-- ============================================

-- Search document chunks
CREATE OR REPLACE FUNCTION search_document_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  document_title TEXT,
  content TEXT,
  page_number INTEGER,
  section_title TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    d.title AS document_title,
    dc.content,
    dc.page_number,
    dc.section_title,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE
    d.is_active = true
    AND d.processing_status = 'completed'
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Search knowledge base articles
CREATE OR REPLACE FUNCTION search_kb_articles(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    title,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_base_articles
  WHERE
    published = true
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_articles_updated_at BEFORE UPDATE ON public.knowledge_base_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guardrails_config_updated_at BEFORE UPDATE ON public.ai_guardrails_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON public.ai_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
