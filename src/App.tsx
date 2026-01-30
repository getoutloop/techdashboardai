import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/components/shared/AuthProvider'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { AdminRoute } from '@/components/shared/AdminRoute'
import { Layout } from '@/components/shared/Layout'

// Pages
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { Dashboard } from '@/pages/Dashboard'
import { Tickets } from '@/pages/Tickets'
import { TicketDetail } from '@/pages/TicketDetail'
import { Kanban } from '@/pages/Kanban'
import { KnowledgeBase } from '@/pages/KnowledgeBase'
import { ArticleView } from '@/pages/ArticleView'
import { Chat } from '@/pages/Chat'

// Admin Pages
import { DocumentLibrary } from '@/pages/admin/DocumentLibrary'
import { DocumentUpload } from '@/pages/admin/DocumentUpload'
import { GuardrailsConfig } from '@/pages/admin/GuardrailsConfig'
import { AIMonitoring } from '@/pages/admin/AIMonitoring'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes with layout */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          {/* Dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Tickets */}
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/kanban" element={<Kanban />} />

          {/* Knowledge Base */}
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/knowledge-base/:id" element={<ArticleView />} />

          {/* AI Chat */}
          <Route path="/chat" element={<Chat />} />

          {/* Admin routes */}
          <Route path="/admin/documents" element={
            <AdminRoute>
              <DocumentLibrary />
            </AdminRoute>
          } />
          <Route path="/admin/documents/upload" element={
            <AdminRoute>
              <DocumentUpload />
            </AdminRoute>
          } />
          <Route path="/admin/guardrails" element={
            <AdminRoute>
              <GuardrailsConfig />
            </AdminRoute>
          } />
          <Route path="/admin/ai-monitoring" element={
            <AdminRoute>
              <AIMonitoring />
            </AdminRoute>
          } />
        </Route>

        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}
