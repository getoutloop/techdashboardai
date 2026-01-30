# AI-Powered Technical Support Dashboard

A comprehensive technical support dashboard built with React, Supabase, and n8n automation. Features AI-powered chat with RAG (Retrieval-Augmented Generation), document management, ticket tracking, and knowledge base.

## Features

- **Ticket Management**: Create, track, and manage support tickets with real-time updates
- **Kanban Board**: Visual drag-and-drop ticket management
- **AI Chat with Guardrails**: AI-powered support chat using document RAG with citation verification
- **Document Management**: Admin-only upload and processing of user manuals and technical docs
- **Knowledge Base**: Searchable articles with vector similarity search
- **Dashboard Analytics**: KPIs, charts, and activity feeds
- **n8n Automation**: Automated notifications and alerts

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Vector Search**: pgvector extension
- **AI**: OpenAI GPT-4 + text-embedding-3-small
- **Automation**: n8n workflows
- **UI Components**: Custom components with Recharts, @dnd-kit, react-dropzone

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- OpenAI API key
- n8n Cloud account (optional, for automation)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd technical_dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Configure your `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### Supabase Setup

1. Create a new Supabase project

2. Enable pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. Run the database migration:
   - Go to SQL Editor in Supabase Dashboard
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Execute the SQL

4. Create Storage bucket:
   - Go to Storage in Supabase Dashboard
   - Create a bucket named `documents` (private)

5. Deploy Edge Functions:
   ```bash
   supabase login
   supabase link --project-ref your-project-ref
   supabase functions deploy process-document
   supabase functions deploy chat-with-guardrails
   ```

6. Set Edge Function secrets:
   ```bash
   supabase secrets set OPENAI_API_KEY=your-openai-key
   ```

### n8n Setup (Optional)

1. Import workflows from `n8n-workflows/` directory
2. Configure Supabase credentials in n8n
3. Configure email/Slack credentials
4. Activate workflows

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── admin/           # Admin-only components
│   │   ├── chat/            # AI chat components
│   │   ├── dashboard/       # Dashboard components
│   │   ├── kanban/          # Kanban board
│   │   ├── kb/              # Knowledge base
│   │   ├── shared/          # Reusable UI components
│   │   └── tickets/         # Ticket management
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   └── utils.ts         # Utility functions
│   ├── pages/               # Page components
│   │   └── admin/           # Admin pages
│   ├── types/               # TypeScript types
│   ├── App.tsx              # Root component
│   └── main.tsx             # Entry point
├── supabase/
│   ├── functions/           # Edge Functions
│   └── migrations/          # Database schema
├── n8n-workflows/           # n8n automation configs
└── public/
```

## Database Schema

The application uses 12 tables:

1. `users` - User profiles with roles (admin, agent, customer)
2. `tickets` - Support tickets with auto-generated numbers
3. `ticket_messages` - Ticket conversation threads
4. `knowledge_base_articles` - KB articles with vector embeddings
5. `documents` - Uploaded documents (admin-only)
6. `document_chunks` - Document chunks for RAG
7. `document_access_logs` - Audit trail
8. `ai_guardrails_config` - AI safety rules
9. `ai_guardrails_logs` - AI interaction logs
10. `ai_chat_sessions` - Chat history
11. `ticket_embeddings` - Ticket similarity search
12. `automation_logs` - n8n workflow logs

## AI Guardrails

The AI chat includes several safety measures:

- **Confidence Threshold**: Minimum confidence score (default: 70%)
- **Source Requirements**: Minimum number of document sources
- **Citation Verification**: AI must cite sources
- **Hallucination Detection**: Blocks responses without proper citations
- **Admin Monitoring**: All interactions logged for review

## User Roles

- **Customer**: Create tickets, view own tickets, use AI chat
- **Agent**: Manage all tickets, access KB editor
- **Admin**: Full access + document management + guardrails config

## Deployment

### Hostinger Horizons

1. Build the project:
   ```bash
   npm run build
   ```

2. Upload the `dist` folder to Hostinger Horizons

3. Configure environment variables in Horizons settings

### Alternative: Vercel/Netlify

The project works with any static hosting that supports SPA routing.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run TypeScript type checking

## License

MIT
