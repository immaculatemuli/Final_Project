# Quick Start Guide - AI Code Review Assistant

## 1. Setup OpenAI API Key (Using .env)

### Step 1: Create .env file

```bash
cd functions
```

Copy the example file:
```bash
cp .env.example .env
```

### Step 2: Add your OpenAI API Key

Open `functions/.env` and add:

```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_API_KEY_HERE

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
```

**Get OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-proj-`)
4. Paste it in `.env` file

**Get Gmail App Password:**
1. Go to https://myaccount.google.com/security
2. Enable 2-Factor Authentication
3. Go to https://myaccount.google.com/apppasswords
4. Generate an app password
5. Copy the 16-character password
6. Paste it in `.env` file

---

## 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd functions
npm install
cd ..
```

---

## 3. Start Development Server

### Terminal 1 - Frontend:
```bash
npm run dev
```

### Terminal 2 - Firebase Functions (optional for local testing):
```bash
cd functions
npm run serve
```

---

## 4. Test OpenAI Integration

### Test 1: Check .env file
```bash
cd functions
cat .env
```

**Expected output:**
```
OPENAI_API_KEY=sk-proj-xxxxx
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Test 2: Analyze Code

1. Open http://localhost:5173 (or your Vite dev server URL)
2. Sign in with Google
3. Paste this test code:
```javascript
function test() {
  var x = 1;
  if (x == 1) {
    console.log("test");
  }
}
```
4. Click "Analyze Code"
5. Wait for AI analysis (15-30 seconds)

**✅ Success indicators:**
- Loading spinner appears
- AI-generated recommendations appear (specific to your code)
- Score is NOT 100% (unless code is perfect)
- Issues list shows specific problems like:
  - "Use let or const instead of var"
  - "Use strict equality (===) instead of loose equality (==)"

**❌ Failure indicators:**
- Alert message: "Analysis failed: AI service not configured"
- No results appear
- Results show 100% with no issues (fallback was used)

### Test 3: Check Browser Console

Open browser DevTools (F12) → Console tab

**Look for:**
- ✅ "OpenAI client initialized successfully" (if backend logs are visible)
- ❌ Any error messages about API keys

### Test 4: Send Recommendation Email

1. After analysis completes, scroll to "Recommendations" section
2. Click "Send Recommendation via Email" button
3. Fill in:
   - Recipient Name: Test User
   - Recipient Email: your-email@example.com
4. Click "Send AI Recommendations"
5. Check your email inbox

**✅ Success:**
- Email received with AI-generated recommendations
- Email subject: "Code Review Results for Test User"
- Email body contains actual recommendations from AI

**❌ If button is disabled:**
- Make sure code analysis completed successfully
- Check browser console for `currentAnalysisId` value
- Refresh page and try again

---

## 5. Troubleshooting

### Issue 1: "Analysis failed: AI service not configured"

**Solution:**
```bash
# Check .env file exists
cd functions
ls -la .env

# Verify OpenAI key is set
cat .env | grep OPENAI_API_KEY

# Make sure key starts with sk-proj-
# If not, get new key from https://platform.openai.com/api-keys
```

### Issue 2: Button "Send Recommendation via Email" is disabled

**Cause:** `analysisId` is not set (analysis didn't complete or failed)

**Solution:**
1. Check browser console for errors
2. Make sure OpenAI analysis completed successfully
3. Look for "analysisId" in network tab response
4. Try analyzing code again

**Debug steps:**
```javascript
// Open browser console and type:
console.log('Analysis ID:', localStorage.getItem('currentAnalysisId'));

// If null or undefined, analysis didn't save properly
```

### Issue 3: Still showing 100% score with no issues

**Cause:** Fallback local analyzer is being used (OpenAI not called)

**Solution:**
1. Check `functions/.env` file has correct OpenAI API key
2. Restart development server
3. Check Firebase Functions logs:
```bash
firebase functions:log --only analyzeCode
```

### Issue 4: Email not sending

**Solution:**
1. Check Gmail app password is correct
2. Verify `functions/.env` has EMAIL_USER and EMAIL_PASS
3. Check Firebase Functions logs for email errors
4. Try with Ethereal test email first (automatic fallback if Gmail fails)

---

## 6. Verify Everything is Working

### Checklist:

- [ ] `.env` file created in `functions/` directory
- [ ] OpenAI API key added (starts with `sk-proj-`)
- [ ] Gmail credentials added
- [ ] Dependencies installed (`npm install` in root and functions/)
- [ ] Dev server running (`npm run dev`)
- [ ] Code analysis returns AI-generated recommendations
- [ ] Score is accurate (not always 100%)
- [ ] "Send Recommendation" button is clickable
- [ ] Email sends successfully with AI recommendations
- [ ] History preview shows recent analyses

---

## 7. Deploy to Production

### Step 1: Deploy Functions

```bash
# Deploy to Firebase
firebase deploy --only functions

# Note: .env file is automatically loaded
# No need for firebase functions:config:set
```

### Step 2: Update Frontend URLs

In production, update these files:
- `src/components/HomePage.tsx` (line 33, 98)
- `src/components/ReviewPanel.tsx` (line 662, 577)

Replace:
```javascript
const functionsUrl = process.env.NODE_ENV === 'production'
  ? 'https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/analyzeCode'
  : '/api/analyzeCode';
```

### Step 3: Deploy Frontend

```bash
# Build frontend
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## 8. Production Environment Variables

For production deployment, set environment variables in Firebase Console:

1. Go to Firebase Console → Functions → Configuration
2. Or use:
```bash
firebase functions:config:set openai.key="YOUR_KEY"
firebase functions:config:set mail.user="your@email.com"
firebase functions:config:set mail.pass="your-password"
```

**Note:** `.env` file works for local development. For production, use Firebase Functions Config OR deploy with `.env` (it will be read automatically).

---

## 9. Testing Workflow

### Complete End-to-End Test:

1. **Start servers**
   ```bash
   npm run dev
   ```

2. **Analyze code**
   - Open http://localhost:5173
   - Sign in
   - Paste code
   - Click "Analyze Code"
   - ✅ Verify AI recommendations appear

3. **Check history**
   - Scroll down to "Recent Analyses"
   - ✅ Verify previous analysis appears
   - Click on history item
   - ✅ Verify it loads in results panel

4. **Send email**
   - Scroll to "Recommendations" section
   - Click "Send Recommendation via Email"
   - ✅ Button should be clickable (not disabled)
   - Fill in name and email
   - Click "Send AI Recommendations"
   - ✅ Success message appears
   - ✅ Check email inbox

5. **Test GitHub analysis**
   - Switch to "GitHub Repository" tab
   - Enter: `https://github.com/expressjs/express`
   - Click "Analyze Repository"
   - ✅ AI analyzes actual repo code
   - ✅ Shows repo metadata (stars, forks)

---

## 10. Common Mistakes to Avoid

### ❌ DON'T:
- Commit `.env` file to Git (it's in `.gitignore`)
- Use `firebase functions:config:set` (not needed with `.env`)
- Forget to restart dev server after changing `.env`
- Use expired OpenAI API keys

### ✅ DO:
- Keep `.env` file in `functions/` directory
- Restart dev server after `.env` changes
- Check OpenAI usage dashboard for API calls
- Test locally before deploying to production

---

## 11. Environment File Locations

```
project-root/
├── functions/
│   ├── .env              ← ADD YOUR KEYS HERE
│   ├── .env.example      ← Template file
│   ├── .gitignore        ← .env is ignored
│   ├── package.json
│   └── index.js
├── src/
│   └── components/
└── package.json
```

---

## 12. Support & Debugging

### Check OpenAI Status:
- https://status.openai.com/

### Check Firebase Logs:
```bash
firebase functions:log
```

### Check .env is loaded:
```bash
cd functions
node -e "require('dotenv').config(); console.log(process.env.OPENAI_API_KEY ? 'API Key loaded' : 'API Key NOT loaded')"
```

**Expected:** `API Key loaded`

### Test OpenAI API directly:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 13. Next Steps

After setup complete:
1. Test all features locally
2. Review DEPLOYMENT_CHECKLIST.md
3. Deploy to Firebase
4. Monitor costs in OpenAI dashboard
5. Set up billing alerts

---

## Quick Commands Reference

```bash
# Start development
npm run dev

# Install dependencies
npm install && cd functions && npm install && cd ..

# Check .env
cat functions/.env

# Deploy to production
firebase deploy

# View logs
firebase functions:log

# Test OpenAI key
cd functions && node -e "require('dotenv').config(); console.log(process.env.OPENAI_API_KEY ? 'OK' : 'MISSING')"
```

---

**Ready to start? Run: `npm run dev` and open http://localhost:5173**

🎉 Happy coding with AI-powered code review!
