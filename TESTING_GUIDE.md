# Testing Guide for Code Analysis Flow

## Issues Fixed

### 1. Missing `setIsAnalyzing(false)` in Success Path
**Problem**: After successful analysis, the UI remained stuck in "Analyzing..." state.
**Fix**: Added `setIsAnalyzing(false)` after setting analysis results in `HomePage.tsx:163`

### 2. Property Name Mismatch
**Problem**: HomePage used `score` property but ReviewPanel expected `overallScore`
**Fix**: Updated all references to use consistent `overallScore` property:
- Interface definition (line 13)
- analyzeCode function (line 138)
- analyzeGithubRepo function (line 87)
- Display logic (lines 370-374, 224)

### 3. Firestore Loading Bug
**Problem**: Firestore loading looked for `data?.result` but backend saves as `data?.analysis`
**Fix**: Updated Firestore snapshot handler to correctly access `data?.analysis` (line 186)

## How to Test

### Step 1: Start Firebase Emulator
```bash
cd "C:\Users\evans\Desktop\CODE WITH EVANS\AI-powered_code_review_assistant"
firebase emulators:start
```

Wait for all functions to initialize. You should see:
```
✔ functions[us-central1-analyzeCode]: http function initialized (http://127.0.0.1:5001/project-70cbf/us-central1/analyzeCode)
```

### Step 2: Start the Development Server
In a new terminal:
```bash
npm run dev
```

The app will run on http://localhost:3001

### Step 3: Test Code Analysis

1. **Open the app** at http://localhost:3001
2. **Sign in** with your account
3. **Paste test code** in the code editor:
   ```javascript
   function calculateSum(a, b) {
     return a + b;
   }
   console.log(calculateSum(5, 3));
   ```
4. **Click "Analyze Code"**

### Expected Behavior

1. ✅ Loading spinner should appear with "Analyzing Your Code" message
2. ✅ After 5-10 seconds, analysis results should display (NOT stuck on loading)
3. ✅ ReviewPanel should show:
   - Overall score percentage
   - Issues breakdown (Critical, High, Medium, Low)
   - Quality metrics
   - Recommendations section
4. ✅ Analysis should be saved to Firestore
5. ✅ Analysis should appear in "Recent Analyses" sidebar

### Step 4: Verify Firestore Storage

1. Open Firebase Emulator UI at http://localhost:4000
2. Go to Firestore tab
3. Check `analyses` collection
4. Verify new document contains:
   - `analysis` field with all analysis data
   - `overallScore` property
   - `uid` matching your user ID
   - `createdAt` timestamp

### Step 5: Test GitHub Repository Analysis

1. Switch to "GitHub Repository" tab
2. Enter a public repo URL: `https://github.com/facebook/react`
3. Click "Analyze Repository"
4. Verify same success flow as code analysis

### Step 6: Test Email Recommendations

1. After analysis completes, scroll to "Recommendations" section
2. Click "Send Recommendation via Email"
3. Enter recipient details
4. Click "Send AI Recommendations"
5. Check console for email preview URL (if using test account)

## Manual API Test (Using curl)

If you want to test the API directly:

```bash
curl -X POST http://127.0.0.1:5001/project-70cbf/us-central1/analyzeCode \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user-123" \
  -d '{
    "code": "function test() { console.log(\"test\"); }",
    "language": "javascript",
    "uid": "test-user-123",
    "filename": "test.js"
  }'
```

Expected response:
```json
{
  "success": true,
  "analysisId": "abc123...",
  "analysis": {
    "language": "javascript",
    "overallScore": 85,
    "issues": [...],
    "recommendations": [...],
    ...
  }
}
```

## Using the Test Script

Run the automated test script:
```bash
node test-analysis-flow.js
```

This will:
- Send a test code snippet to the API
- Verify response structure
- Display analysis summary
- Confirm Firestore save (if analysisId is returned)

## Troubleshooting

### Issue: "Analysis failed" alert
**Solution**: Check functions logs in emulator terminal for error details

### Issue: Stuck on "Analyzing..." forever
**Solution**: This was the main bug - should be fixed now. If it persists:
1. Check browser console for errors
2. Verify API endpoint in HomePage.tsx:128 matches emulator URL
3. Check CORS settings in functions/index.js

### Issue: "No analysis ID available"
**Solution**: Ensure Firestore emulator is running (not just functions)
```bash
firebase emulators:start  # Run ALL emulators, not just --only functions
```

### Issue: Results not showing in ReviewPanel
**Solution**:
1. Check browser console for property access errors
2. Verify analysis object has `overallScore` (not `score`)
3. Check Network tab to see actual API response

## Performance Notes

- Analysis typically takes 5-15 seconds (depends on OpenAI API response time)
- First request may be slower (cold start)
- Rate limit: 10 requests per minute per user
- Maximum code size: 60KB

## Summary of Changes

**Files Modified:**
1. `src/components/HomePage.tsx` - Fixed setIsAnalyzing, property names, Firestore loading
2. `functions/index.js` - Already correct, saves to Firestore properly
3. `src/components/ReviewPanel.tsx` - No changes needed (already expects correct structure)

**Test Files Created:**
1. `test-analysis-flow.js` - Automated API test script
2. `TESTING_GUIDE.md` - This comprehensive testing guide
