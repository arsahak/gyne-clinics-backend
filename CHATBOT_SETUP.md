# AI Chatbot Setup Guide

This guide will help you set up the AI-powered chatbot with knowledge base functionality for GyneClinics.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **MongoDB** (local or Atlas)
3. **OpenAI API Key**
4. **Pinecone Account**

---

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

---

## Step 2: Set Up OpenAI

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **"Create new secret key"**
5. Copy the API key (starts with `sk-`)
6. Save it securely - you'll need it for the `.env` file

**Pricing**: 
- Text Embedding 3 Small: $0.02 per 1M tokens
- GPT-4 Turbo: $0.01 per 1K input tokens, $0.03 per 1K output tokens

---

## Step 3: Set Up Pinecone

### Create Pinecone Account

1. Go to [Pinecone](https://www.pinecone.io/)
2. Sign up for a free account
3. After login, go to **API Keys** tab
4. Copy your API key

### Create a Pinecone Index

1. In Pinecone dashboard, click **"Create Index"**
2. Configure the index:
   - **Name**: `gyneclinics-kb` (or any name you prefer)
   - **Dimensions**: `1536` (for OpenAI text-embedding-3-small)
   - **Metric**: `cosine`
   - **Cloud**: AWS (recommended) or GCP
   - **Region**: Choose closest to your users
3. Click **"Create Index"**
4. Wait for index to be ready (usually 1-2 minutes)

**Free Tier**: 
- 1 index
- 100K vectors
- 1 pod
- Should be enough for testing and small deployments

---

## Step 4: Configure Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` file with your credentials:
   ```env
   # MongoDB
   MONGO_URI=mongodb://localhost:27017/gyneclinics
   
   # OpenAI
   OPENAI_API_KEY=sk-your-actual-openai-key-here
   
   # Pinecone
   PINECONE_API_KEY=your-actual-pinecone-key-here
   PINECONE_INDEX_NAME=gyneclinics-kb
   
   # Other settings
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=your_jwt_secret
   ```

---

## Step 5: Start the Backend Server

```bash
npm run dev
```

You should see:
```
✅ OpenAI client initialized successfully
✅ Pinecone client initialized successfully
🚀 Server Started Successfully!
🌐 Environment: development
🔗 Server URL: http://localhost:5000
```

---

## Step 6: Test the API

### Health Check

```bash
curl http://localhost:5000/health
```

### Upload Knowledge Base Document

```bash
curl -X POST http://localhost:5000/api/knowledge-base/upload \
  -F "file=@/path/to/document.pdf" \
  -F "chatbotType=general" \
  -F "description=General gynaecology information"
```

Chatbot types: `general`, `urogynaecology`, `aesthetic`, `menopause`

### Check Upload Status

```bash
curl http://localhost:5000/api/knowledge-base/list?chatbotType=general
```

Status values:
- `pending` - Just uploaded
- `processing` - Being processed
- `completed` - Ready to use
- `failed` - Error occurred

### Test Chat Query

```bash
curl -X POST http://localhost:5000/api/chatbot/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What causes heavy periods?",
    "chatbotType": "general",
    "sessionId": "test-session-123"
  }'
```

---

## Step 7: Frontend Integration (Next.js)

Update `website/component/shared/AIChatbotModal.tsx`:

```typescript
const handleSendMessage = async (text?: string) => {
  const messageText = text || inputValue.trim();
  if (!messageText) return;

  // Add user message
  const userMessage: Message = {
    id: Date.now().toString(),
    text: messageText,
    sender: "user",
    timestamp: new Date(),
  };
  setMessages((prev) => [...prev, userMessage]);
  setInputValue("");
  setIsTyping(true);

  try {
    // Call backend API
    const response = await fetch('http://localhost:5000/api/chatbot/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageText,
        chatbotType: chatbotType,
        sessionId: `session-${Date.now()}`, // Generate unique session ID
        conversationHistory: messages.slice(-5).map(m => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text
        }))
      })
    });

    const data = await response.json();
    
    if (data.success) {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.data.response,
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Chatbot error:', error);
    // Show error message
    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: "Sorry, I'm having trouble responding right now. Please try again.",
      sender: "ai",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, errorMessage]);
  } finally {
    setIsTyping(false);
  }
};
```

---

## API Endpoints Reference

### Knowledge Base Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/knowledge-base/upload` | Upload PDF document |
| GET | `/api/knowledge-base/list` | List all documents |
| GET | `/api/knowledge-base/:id` | Get document details |
| DELETE | `/api/knowledge-base/:id` | Delete document |
| GET | `/api/knowledge-base/stats` | Get statistics |

### Chatbot

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chatbot/query` | Send chat message |
| GET | `/api/chatbot/conversation/:sessionId` | Get conversation |
| GET | `/api/chatbot/conversations` | List conversations |
| DELETE | `/api/chatbot/conversation/:sessionId` | Delete conversation |
| GET | `/api/chatbot/stats` | Get statistics |

---

## Recommended Documents to Upload

### General Gynaecology
- Menstrual health guidelines
- PCOS information
- Endometriosis guides
- Contraception options
- Screening protocols

### Urogynaecology
- Urinary incontinence guides
- Pelvic organ prolapse information
- Pelvic floor exercises
- Urodynamics testing info

### Aesthetic Gynaecology
- Labiaplasty procedure details
- Laser rejuvenation information
- Recovery guidelines
- Safety protocols

### Menopause
- HRT information
- Symptom management guides
- Lifestyle recommendations
- BMS guidelines

---

## Troubleshooting

### "OPENAI_API_KEY is not defined"
- Check your `.env` file
- Ensure the key starts with `sk-`
- Restart the server after changing `.env`

### "PINECONE_API_KEY is not defined"
- Check your `.env` file
- Verify the API key from Pinecone dashboard
- Restart the server

### "Failed to upsert vectors"
- Check Pinecone index dimensions (should be 1536)
- Verify index name matches `.env` file
- Check Pinecone dashboard for quota limits

### "Processing stuck on 'processing' status"
- Check server logs for errors
- Verify PDF is readable and has text (not scanned images)
- Check OpenAI API quota

---

## Cost Estimates

### For 100 PDF Pages Uploaded:
- Text extraction: Free
- Embeddings: ~$0.10
- Storage (Pinecone): Free tier

### For 1000 Chat Queries:
- Embeddings: ~$0.01
- GPT-4 responses: ~$30-50
- Total: ~$30-50/month

### Tips to Reduce Costs:
1. Use GPT-3.5 instead of GPT-4 (change in `ragService.ts`)
2. Reduce `maxTokens` in responses
3. Cache common queries
4. Use smaller embedding model if possible

---

## Next Steps

1. Upload your knowledge base documents
2. Test the chatbot with various queries
3. Update frontend to use real API
4. Add admin panel for document management
5. Monitor usage and costs

---

## Support

For issues or questions:
- Check OpenAI status: https://status.openai.com/
- Check Pinecone status: https://status.pinecone.io/
- Review server logs in `backend` folder
