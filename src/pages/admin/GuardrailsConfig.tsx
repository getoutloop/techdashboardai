import { useEffect, useState } from 'react'
import { Save, Shield, AlertTriangle, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { supabase } from '@/lib/supabase'

interface AIGuardrailConfig {
  id: string
  rule_name: string
  rule_type: string
  rule_value: Record<string, unknown>
  is_enabled: boolean
  description: string | null
  created_at: string
  updated_at: string
}

interface GuardrailSettings {
  confidenceThreshold: number
  minSources: number
  requireCitation: boolean
  maxTokens: number
  blockUnsupported: boolean
}

export function GuardrailsConfig() {
  const [_configs, setConfigs] = useState<AIGuardrailConfig[]>([])
  const [settings, setSettings] = useState<GuardrailSettings>({
    confidenceThreshold: 0.7,
    minSources: 1,
    requireCitation: true,
    maxTokens: 1000,
    blockUnsupported: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchConfigs()
  }, [])

  async function fetchConfigs() {
    const { data, error } = await supabase
      .from('ai_guardrails_config')
      .select('*')
      .order('rule_name')

    if (!error && data) {
      const typedData = data as AIGuardrailConfig[]
      setConfigs(typedData)

      // Parse existing configs
      const confidenceConfig = typedData.find((c) => c.rule_name === 'min_confidence')
      const sourceConfig = typedData.find((c) => c.rule_name === 'require_sources')
      const responseConfig = typedData.find((c) => c.rule_name === 'max_response_length')
      const blockConfig = typedData.find((c) => c.rule_name === 'block_unsupported')
      const citationConfig = typedData.find((c) => c.rule_name === 'citation_required')

      setSettings({
        confidenceThreshold: (confidenceConfig?.rule_value as Record<string, number>)?.threshold || 0.7,
        minSources: (sourceConfig?.rule_value as Record<string, number>)?.min_sources || 1,
        requireCitation: (citationConfig?.rule_value as Record<string, boolean>)?.required ?? true,
        maxTokens: (responseConfig?.rule_value as Record<string, number>)?.max_tokens || 1000,
        blockUnsupported: (blockConfig?.rule_value as Record<string, boolean>)?.enabled ?? true,
      })
    }
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    setSaved(false)

    try {
      // Update each config
      const updates = [
        {
          rule_name: 'min_confidence',
          rule_value: { threshold: settings.confidenceThreshold },
        },
        {
          rule_name: 'require_sources',
          rule_value: { min_sources: settings.minSources },
        },
        {
          rule_name: 'citation_required',
          rule_value: { required: settings.requireCitation },
        },
        {
          rule_name: 'max_response_length',
          rule_value: { max_tokens: settings.maxTokens },
        },
        {
          rule_name: 'block_unsupported',
          rule_value: { enabled: settings.blockUnsupported },
        },
      ]

      for (const update of updates) {
        await supabase
          .from('ai_guardrails_config')
          .upsert(
            {
              ...update,
              rule_type: update.rule_name.includes('confidence')
                ? 'confidence_threshold'
                : update.rule_name.includes('source') || update.rule_name.includes('citation')
                ? 'source_requirement'
                : update.rule_name.includes('response')
                ? 'response_length'
                : 'content_filter',
              is_enabled: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'rule_name' }
          )
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Guardrails Configuration</h1>
        <p className="text-gray-600">
          Configure safety rules for AI-generated responses
        </p>
      </div>

      {/* Confidence Threshold */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            Confidence Threshold
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Minimum confidence score required for AI responses. Responses below this
            threshold will show a warning or be blocked.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={settings.confidenceThreshold * 100}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  confidenceThreshold: parseInt(e.target.value) / 100,
                }))
              }
              className="flex-1"
            />
            <span className="text-lg font-semibold text-gray-900 w-16 text-right">
              {Math.round(settings.confidenceThreshold * 100)}%
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>More permissive</span>
            <span>More restrictive</span>
          </div>
        </CardContent>
      </Card>

      {/* Source Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Source Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Sources Required
            </label>
            <p className="text-sm text-gray-600 mb-3">
              Number of document sources that must be found before AI can respond.
            </p>
            <Input
              type="number"
              min="0"
              max="10"
              value={settings.minSources}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  minSources: parseInt(e.target.value) || 0,
                }))
              }
              className="w-32"
            />
          </div>

          <div className="pt-4 border-t border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireCitation}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    requireCitation: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="font-medium text-gray-900">
                  Require Source Citations
                </span>
                <p className="text-sm text-gray-500">
                  AI responses must include [Source N] citations
                </p>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Response Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Response Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Response Tokens
            </label>
            <p className="text-sm text-gray-600 mb-3">
              Maximum length of AI responses (1 token ~ 4 characters).
            </p>
            <Input
              type="number"
              min="100"
              max="4000"
              step="100"
              value={settings.maxTokens}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  maxTokens: parseInt(e.target.value) || 1000,
                }))
              }
              className="w-32"
            />
          </div>

          <div className="pt-4 border-t border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.blockUnsupported}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    blockUnsupported: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="font-medium text-gray-900">
                  Block Unsupported Responses
                </span>
                <p className="text-sm text-gray-500">
                  Completely block responses that don't meet requirements
                </p>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center justify-between">
        <div>
          {saved && (
            <span className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Settings saved successfully
            </span>
          )}
        </div>
        <Button onClick={saveSettings} loading={saving}>
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  )
}
