# Deployment Checklist - AI Code Review Assistant

## Pre-Deployment Checklist

### 1. Firebase Configuration
- [ ] Create Firebase project at https://console.firebase.google.com
- [ ] Upgrade to Blaze (pay-as-you-go) plan
- [ ] Enable Firestore Database
- [ ] Enable Firebase Authentication (Google Sign-In)
- [ ] Enable Firebase Functions
- [ ] Note your project ID: `_________________`

### 2. Set Firebase Functions Config

Run these commands in your terminal:

```bash
# Navigate to project directory
cd "C:\Users\evans\Desktop\CODE WITH EVANS\AI-powered_code_review_assistant"

# Login to Firebase (if not already logged in)
firebase login

# Initialize Firebase (if not already initialized)
firebase init

# Set OpenAI API Key
firebase functions:config:set openai.key="YOUR_OPENAI_API_KEY_HERE"

# Set Email Configuration (for Gmail)
firebase functions:config:set mail.host="smtp.gmail.com"
firebase functions:config:set mail.port="587"
firebase functions:config:set mail.user="your-email@gmail.com"
firebase functions:config:set mail.pass="YOUR_APP_PASSWORD"
firebase functions:config:set mail.from="AI Code Review <noreply@yourdomain.com>"

# Verify configuration
firebase functions:config:get
```

### 3. Create Gmail App Password

If using Gmail for email:
1. Go to https://myaccount.google.com/security
2. Enable 2-Factor Authentication
3. Go to https://myaccount.google.com/apppasswords
4. Generate an app password for "Mail"
5. Use the 16-character password in the config above

### 4. Create Local .env File for Development

Create `functions/.env`:

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**Important:** Add `.env` to `.gitignore` to prevent committing secrets!

### 5. Update Firebase Project ID

Update the project ID in these files:
- [ ] `.firebaserc` - Set your project ID
- [ ] `src/components/HomePage.tsx` - Update production URLs (line 33, 98)
- [ ] `src/components/ReviewPanel.tsx` - Update production URLs (line 661)

**Find and replace:**
```
OLD: https://us-central1-project-70cbf.cloudfunctions.net
NEW: https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net
```

### 6. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd functions
npm install
cd ..
```

### 7. Create Firestore Indexes

Go to Firebase Console → Firestore → Indexes → Add Index:

**Index 1:**
- Collection: `analyses`
- Fields:
  - `uid` (Ascending)
  - `createdAt` (Descending)

### 8. Deploy Firebase Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Monitor deployment logs
firebase functions:log --only analyzeCode
```

### 9. Update CORS Settings (Production)

In `functions/index.js`, update line 12:

**Development:**
```javascript
res.set('Access-Control-Allow-Origin', '*');
```

**Production (recommended):**
```javascript
res.set('Access-Control-Allow-Origin', 'https://your-domain.com');
```

### 10. Test Endpoints

Test each function:

```bash
# Test Code Analysis
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/analyzeCode \
  -H "Content-Type: application/json" \
  -d '{"code":"const x = 1;","uid":"test"}'

# Test GitHub Analysis
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/analyzeGithubRepo \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/facebook/react","uid":"test"}'

# Test List Analyses
curl https://us-central1-YOUR-PROJECT.cloudfunctions.net/listRecentAnalyses?limit=5

# Test Email (requires valid analysisId)
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/sendRecommendationEmailV2 \
  -H "Content-Type: application/json" \
  -d '{"analysisId":"YOUR_ID","to":"test@example.com"}'
```

---

## Deployed Cloud Functions

After deployment, you should have these functions:

1. ✅ **analyzeCode** - AI-powered code analysis
2. ✅ **analyzeGithubRepo** - GitHub repository analysis
3. ✅ **listRecentAnalyses** - Retrieve analysis history
4. ✅ **sendRecommendationEmail** - Original email sender
5. ✅ **sendRecommendationEmailV2** - Firestore-based email sender
6. ✅ **sendAnalysisReport** - Send full analysis report
7. ✅ **sendPasswordReset** - Firebase password reset

---

## Frontend Deployment

### Option 1: Firebase Hosting

```bash
# Build frontend
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

### Option 2: Vercel/Netlify

1. Connect your GitHub repository
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables (if any)

---

## Post-Deployment Verification

### Test Workflow:

1. **Login Test:**
   - [ ] Navigate to your app URL
   - [ ] Sign in with Google
   - [ ] Verify authentication works

2. **Code Analysis Test:**
   - [ ] Paste sample code
   - [ ] Click "Analyze Code"
   - [ ] Verify OpenAI analysis runs
   - [ ] Check results display correctly
   - [ ] Verify data saved to Firestore

3. **GitHub Analysis Test:**
   - [ ] Switch to "GitHub Repository" tab
   - [ ] Enter public repo URL (e.g., `https://github.com/expressjs/express`)
   - [ ] Click "Analyze Repository"
   - [ ] Verify analysis completes
   - [ ] Check repository info displays

4. **Email Test:**
   - [ ] Click "Send Recommendation via Email"
   - [ ] Enter recipient details
   - [ ] Send email
   - [ ] Check email received

5. **Firestore Verification:**
   - [ ] Go to Firebase Console → Firestore
   - [ ] Check `analyses` collection has documents
   - [ ] Verify data structure is correct

---

## Monitoring & Maintenance

### Check Firebase Functions Logs:
```bash
firebase functions:log

# Or view in Firebase Console:
# https://console.firebase.google.com/project/YOUR-PROJECT/functions/logs
```

### Monitor Costs:
- Firebase Console → Usage and billing
- OpenAI Dashboard → Usage
- Set up billing alerts

### Expected Monthly Costs (for ~1000 analyses):
- OpenAI API: ~$0.50
- Firebase Functions: ~$1.00 (after free tier)
- Firestore: ~$0.10 (minimal)
- **Total: ~$1.60/month**

---

## Troubleshooting

### "AI service not configured"
```bash
# Check if OpenAI key is set
firebase functions:config:get

# If empty, set it again
firebase functions:config:set openai.key="YOUR_KEY"
firebase deploy --only functions
```

### Email not sending
- Verify Gmail app password is correct
- Check Firebase Functions logs for errors
- Test with Ethereal (test email service) first

### CORS errors
- Update `Access-Control-Allow-Origin` in functions/index.js
- Redeploy functions after changes

### Rate limit errors
- Check rate limit settings in functions/index.js (line 203)
- Adjust maxRequests if needed

---

## Security Recommendations

### Production Security:
1. **Enable App Check** (Firebase Console → App Check)
2. **Restrict CORS** to your domain only
3. **Add Firestore Security Rules:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /analyses/{document} {
      allow read: if request.auth != null &&
                     (resource.data.uid == request.auth.uid ||
                      request.auth.token.admin == true);
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null &&
                               resource.data.uid == request.auth.uid;
    }

    match /feedback/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. **Set up Firebase Authentication** security rules
5. **Enable reCAPTCHA** for sign-in
6. **Monitor for suspicious activity**

---

## Next Steps After Deployment

- [ ] Test all features thoroughly
- [ ] Set up monitoring alerts
- [ ] Configure custom domain (optional)
- [ ] Add analytics (Google Analytics, Mixpanel)
- [ ] Create user documentation
- [ ] Set up automated backups for Firestore
- [ ] Plan for scaling (Redis for rate limiting, etc.)

---

## Support

If you encounter issues:
1. Check Firebase Functions logs: `firebase functions:log`
2. Review browser console for frontend errors
3. Verify all environment variables are set
4. Check OpenAI API status: https://status.openai.com
5. Review SETUP_GUIDE.md for detailed configuration

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Project ID:** _____________
**Production URL:** _____________

---

## Quick Commands Reference

```bash
# View logs
firebase functions:log

# Redeploy functions
firebase deploy --only functions

# Redeploy hosting
firebase deploy --only hosting

# View config
firebase functions:config:get

# Local development
npm run dev
cd functions && npm run serve

# Build for production
npm run build
```

---

✅ **Deployment Complete!** Your AI Code Review Assistant is now live.
