# AI Code Review Assistant - Setup Guide

## Overview
This enhanced AI Code Review system uses **OpenAI API**, **Firebase Cloud Functions**, **Firestore**, and **Nodemailer** to provide real-time code analysis with email recommendations.

---

## Features Implemented

✅ **OpenAI-Powered Code Analysis** - Uses GPT-4o-mini for intelligent code review
✅ **GitHub Repository Analysis** - Analyze public GitHub repositories
✅ **Firestore Persistence** - Store all analysis results with metadata
✅ **Email Recommendations** - Send detailed code review reports via email
✅ **Rate Limiting** - Protect API from abuse (10 requests/min per user)
✅ **Security Validations** - Input sanitization and size limits (60KB max)
✅ **Structured JSON Output** - Consistent analysis format with metrics

---

## Prerequisites

1. **Node.js** 18+ installed
2. **Firebase CLI** installed (`npm install -g firebase-tools`)
3. **Firebase Project** with Blaze (pay-as-you-go) plan
4. **OpenAI API Key** from https://platform.openai.com/api-keys
5. **SMTP Email Credentials** (Gmail or other SMTP provider)

---

## Configuration Steps

### 1. Set Up Firebase Functions Config

You need to configure the following secrets:

```bash
# Navigate to functions directory
cd functions

# Set OpenAI API Key
firebase functions:config:set openai.key="YOUR_OPENAI_API_KEY"

# Set Email SMTP Configuration
firebase functions:config:set mail.host="smtp.gmail.com"
firebase functions:config:set mail.port="587"
firebase functions:config:set mail.user="your-email@gmail.com"
firebase functions:config:set mail.pass="YOUR_APP_PASSWORD"
firebase functions:config:set mail.from="AI Code Review <noreply@yourdomain.com>"
```

**For Gmail:**
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the generated 16-character password as `mail.pass`

### 2. Set Environment Variables (Local Development)

Create a `.env` file in the `functions` directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your_app_password_here
```

### 3. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install functions dependencies
cd functions
npm install
```

### 4. Deploy Firebase Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:analyzeCode
firebase deploy --only functions:analyzeGithubRepo
firebase deploy --only functions:listRecentAnalyses
firebase deploy --only functions:sendRecommendationEmailV2
```

### 5. Configure Firestore

Create the following Firestore structure:

**Collection: `analyses`**
```json
{
  "codeHash": "string",
  "language": "string",
  "filename": "string",
  "type": "code|github",
  "uid": "string|null",
  "repository": {
    "owner": "string",
    "name": "string",
    "url": "string"
  },
  "analysis": {
    "language": "string",
    "summary": "string",
    "overallScore": "number",
    "issues": "array",
    "metrics": "object",
    "recommendations": "array",
    "codeSmells": "number",
    "technicalDebt": "string"
  },
  "createdAt": "timestamp",
  "model": "gpt-4o-mini"
}
```

Create an index for queries:
- Collection: `analyses`
- Fields: `uid` (Ascending), `createdAt` (Descending)

---

## API Endpoints

### 1. **analyzeCode** - Analyze code snippet
**POST** `/analyzeCode`

**Request Body:**
```json
{
  "code": "const x = 1;",
  "filename": "example.js",
  "uid": "user_id_optional"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "language": "javascript",
    "summary": "Brief code overview",
    "overallScore": 85,
    "issues": [...],
    "metrics": {...},
    "recommendations": [...]
  },
  "analysisId": "firestore_document_id"
}
```

**Rate Limit:** 10 requests per minute per user
**Max Code Size:** 60KB

---

### 2. **analyzeGithubRepo** - Analyze GitHub repository
**POST** `/analyzeGithubRepo`

**Request Body:**
```json
{
  "repoUrl": "https://github.com/owner/repo",
  "uid": "user_id_optional"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "repository": {
      "owner": "owner",
      "name": "repo",
      "stars": 123,
      "analyzedFile": "index.js"
    },
    "overallScore": 80,
    "issues": [...],
    "recommendations": [...]
  },
  "analysisId": "firestore_document_id"
}
```

**Rate Limit:** 5 requests per minute per user
**Restrictions:** Public repositories only

---

### 3. **listRecentAnalyses** - Get recent analyses
**GET** `/listRecentAnalyses?uid=USER_ID&limit=10`
**POST** `/listRecentAnalyses`

**Request Body (POST):**
```json
{
  "uid": "user_id_optional",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "analyses": [
    {
      "id": "doc_id",
      "language": "javascript",
      "filename": "app.js",
      "type": "code",
      "overallScore": 85,
      "totalIssues": 3,
      "createdAt": "2025-10-11T10:00:00Z"
    }
  ],
  "count": 1
}
```

---

### 4. **sendRecommendationEmailV2** - Send email with recommendations
**POST** `/sendRecommendationEmailV2`

**Request Body:**
```json
{
  "analysisId": "firestore_document_id",
  "to": "recipient@example.com",
  "subject": "Your Code Review Results (optional)"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Email sent successfully",
  "previewUrl": "https://ethereal.email/message/..."
}
```

---

## Frontend Integration

### Update HomePage.tsx to support GitHub analysis:

```typescript
const analyzeGithubRepo = async (repoUrl: string) => {
  setIsAnalyzing(true);
  try {
    const functionsUrl = process.env.NODE_ENV === 'production'
      ? 'https://us-central1-YOUR-PROJECT.cloudfunctions.net/analyzeGithubRepo'
      : '/api/analyzeGithubRepo';

    const response = await fetch(functionsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoUrl,
        uid: user.uid
      })
    });

    const data = await response.json();
    if (data.success) {
      setAnalysis(data.analysis);
    }
  } catch (error) {
    console.error('GitHub analysis failed:', error);
  } finally {
    setIsAnalyzing(false);
  }
};
```

---

## Security Best Practices

1. **Never expose API keys in frontend code**
2. **Use Firebase Functions Config** for production secrets
3. **Enable CORS** only for your domain in production
4. **Validate all inputs** on the backend
5. **Implement rate limiting** per user/IP
6. **Limit file sizes** to prevent DoS attacks
7. **Use HTTPS** for all API calls
8. **Store passwords securely** using Firebase Auth

---

## Testing

### Test Code Analysis:
```bash
curl -X POST http://localhost:5001/PROJECT-ID/us-central1/analyzeCode \
  -H "Content-Type: application/json" \
  -d '{"code":"const x = 1; console.log(x);","filename":"test.js"}'
```

### Test GitHub Analysis:
```bash
curl -X POST http://localhost:5001/PROJECT-ID/us-central1/analyzeGithubRepo \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/facebook/react"}'
```

### Test Email Sending:
```bash
curl -X POST http://localhost:5001/PROJECT-ID/us-central1/sendRecommendationEmailV2 \
  -H "Content-Type: application/json" \
  -d '{"analysisId":"YOUR_ANALYSIS_ID","to":"test@example.com"}'
```

---

## Deployment Checklist

- [ ] Set all Firebase Functions Config variables
- [ ] Update CORS allowed origins for production
- [ ] Configure Firestore indexes
- [ ] Deploy Firebase Functions
- [ ] Update frontend API URLs with production endpoints
- [ ] Test all endpoints in production
- [ ] Monitor Firebase Functions logs
- [ ] Set up billing alerts on Firebase console

---

## Troubleshooting

### "AI service not configured" error
- Check that `OPENAI_API_KEY` is set in Firebase Functions Config
- Run `firebase functions:config:get` to verify

### Email not sending
- Verify SMTP credentials are correct
- Check Gmail App Password is valid
- Review Firebase Functions logs: `firebase functions:log`

### Rate limit errors
- Adjust rate limit in code if needed
- Implement Redis for production-grade rate limiting

### GitHub API errors
- Check if repository is public
- Verify GitHub API rate limits (60 requests/hour for unauthenticated)
- Consider adding GitHub Personal Access Token for higher limits

---

## Cost Estimation

**OpenAI API (GPT-4o-mini):**
- ~$0.00015 per code analysis (typical)
- ~$0.45 for 3,000 analyses

**Firebase Functions:**
- Free tier: 125K invocations/month
- ~$0.40 per 1M invocations after free tier

**Firestore:**
- Free tier: 50K reads, 20K writes/day
- Minimal costs for small-medium apps

---

## Support

For issues or questions:
1. Check Firebase Functions logs: `firebase functions:log`
2. Review OpenAI API status: https://status.openai.com/
3. Check Firestore indexes are created
4. Verify all environment variables are set

---

## Next Steps

1. Add user authentication integration
2. Implement caching for repeated analyses
3. Add support for private GitHub repositories (OAuth)
4. Create admin dashboard for analytics
5. Implement webhook notifications
6. Add batch analysis for multiple files
7. Create CI/CD integration for automated reviews

---

**Last Updated:** 2025-10-11
**Version:** 2.0.0
