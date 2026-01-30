# n8n Automation Workflows

This directory contains n8n workflow configurations for automating technical support tasks.

## Prerequisites

- n8n Cloud account or self-hosted instance
- Supabase credentials configured in n8n
- Email/Slack credentials for notifications

## Workflows

### 1. Document Processing Notification

**File:** `document-processing-notification.json`

**Trigger:** Webhook POST from Supabase Edge Function

**Purpose:** Notify admins when document processing completes or fails.

**Flow:**
1. Receive webhook with document ID and status
2. Query Supabase for document details
3. Format notification message
4. Send notification via email/Slack

**Setup:**
1. Import the workflow JSON into n8n
2. Configure Supabase credentials
3. Configure email/Slack credentials
4. Copy the webhook URL
5. Add webhook URL to Edge Function environment

---

### 2. AI Hallucination Alert

**File:** `ai-hallucination-alert.json`

**Trigger:** Scheduled (every 15 minutes)

**Purpose:** Alert admins when AI guardrails are frequently triggered.

**Flow:**
1. Query `ai_guardrails_logs` for recent blocked responses
2. If count > threshold (default: 5), send alert
3. Include summary of blocked queries and reasons

**Configuration:**
- `ALERT_THRESHOLD`: Number of blocked responses to trigger alert (default: 5)
- `TIME_WINDOW`: Minutes to look back (default: 15)

---

### 3. Document Usage Analytics

**File:** `document-usage-analytics.json`

**Trigger:** Scheduled (daily at 9:00 AM)

**Purpose:** Send daily report of document usage and AI performance.

**Flow:**
1. Query `document_access_logs` for yesterday
2. Aggregate by document and access type
3. Query `ai_guardrails_logs` for performance metrics
4. Generate HTML report
5. Send via email

**Report includes:**
- Most accessed documents
- AI chat usage statistics
- Average confidence scores
- Blocked response rate

---

### 4. Low Confidence Response Alert

**File:** `low-confidence-alert.json`

**Trigger:** Webhook POST from chat-with-guardrails Edge Function

**Purpose:** Create internal ticket for human review when AI confidence is low.

**Flow:**
1. Receive webhook with query, response, and confidence
2. Create ticket in Supabase if confidence < threshold
3. Notify support team via Slack

---

## Workflow JSON Templates

### Document Processing Notification

```json
{
  "name": "Document Processing Notification",
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "parameters": {
        "httpMethod": "POST",
        "path": "document-processed"
      }
    },
    {
      "name": "Get Document",
      "type": "n8n-nodes-base.supabase",
      "position": [450, 300],
      "parameters": {
        "operation": "getAll",
        "tableId": "documents",
        "filters": {
          "filter": [
            {
              "fieldName": "id",
              "condition": "eq",
              "fieldValue": "={{ $json.documentId }}"
            }
          ]
        }
      }
    },
    {
      "name": "Check Status",
      "type": "n8n-nodes-base.if",
      "position": [650, 300],
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.processing_status }}",
              "value2": "completed"
            }
          ]
        }
      }
    },
    {
      "name": "Send Success Email",
      "type": "n8n-nodes-base.emailSend",
      "position": [850, 200],
      "parameters": {
        "toEmail": "admin@example.com",
        "subject": "Document Processed: {{ $json.title }}",
        "text": "Document '{{ $json.title }}' has been processed.\n\nChunks: {{ $json.total_chunks }}\nPages: {{ $json.total_pages }}"
      }
    },
    {
      "name": "Send Failure Alert",
      "type": "n8n-nodes-base.emailSend",
      "position": [850, 400],
      "parameters": {
        "toEmail": "admin@example.com",
        "subject": "Document Processing Failed: {{ $json.title }}",
        "text": "Document '{{ $json.title }}' failed to process.\n\nError: {{ $json.processing_error }}"
      }
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{"node": "Get Document", "type": "main", "index": 0}]]
    },
    "Get Document": {
      "main": [[{"node": "Check Status", "type": "main", "index": 0}]]
    },
    "Check Status": {
      "main": [
        [{"node": "Send Success Email", "type": "main", "index": 0}],
        [{"node": "Send Failure Alert", "type": "main", "index": 0}]
      ]
    }
  }
}
```

### AI Hallucination Alert

```json
{
  "name": "AI Hallucination Alert",
  "nodes": [
    {
      "name": "Schedule",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300],
      "parameters": {
        "rule": {
          "interval": [{"field": "minutes", "minutesInterval": 15}]
        }
      }
    },
    {
      "name": "Query Blocked Responses",
      "type": "n8n-nodes-base.supabase",
      "position": [450, 300],
      "parameters": {
        "operation": "getAll",
        "tableId": "ai_guardrails_logs",
        "filters": {
          "filter": [
            {
              "fieldName": "blocked_response",
              "condition": "eq",
              "fieldValue": "true"
            },
            {
              "fieldName": "created_at",
              "condition": "gte",
              "fieldValue": "={{ $now.minus({minutes: 15}).toISO() }}"
            }
          ]
        }
      }
    },
    {
      "name": "Check Threshold",
      "type": "n8n-nodes-base.if",
      "position": [650, 300],
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{ $json.length }}",
              "operation": "larger",
              "value2": 5
            }
          ]
        }
      }
    },
    {
      "name": "Send Alert",
      "type": "n8n-nodes-base.slack",
      "position": [850, 300],
      "parameters": {
        "channel": "#support-alerts",
        "text": "⚠️ AI Guardrails Alert\n\n{{ $json.length }} responses blocked in the last 15 minutes.\n\nPlease review the AI monitoring dashboard."
      }
    }
  ]
}
```

## Setting Up Credentials in n8n

### Supabase

1. Go to n8n Credentials
2. Add new "Supabase" credential
3. Enter your Supabase URL
4. Enter your Service Role Key (from Supabase Dashboard > Settings > API)

### Email (SMTP)

1. Add new "SMTP" credential
2. Configure your SMTP server details
3. Test the connection

### Slack

1. Add new "Slack" credential
2. Create a Slack App and get OAuth token
3. Invite bot to relevant channels

## Testing Workflows

1. Use n8n's "Test workflow" button
2. For webhook triggers, use the test URL provided
3. Monitor execution logs for errors
4. Check notifications are received
