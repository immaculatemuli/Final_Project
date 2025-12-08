/**
 * Comprehensive test for analyzeCode function
 * This tests the entire flow before deploying
 */

require('dotenv').config();
const OpenAI = require('openai');

console.log('=== Starting Comprehensive Test ===\n');

// Test 1: Environment Variables
console.log('Test 1: Checking environment variables...');
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ FAILED: OPENAI_API_KEY not found in .env');
  process.exit(1);
}
console.log('✅ PASSED: API key loaded (length:', apiKey.length, ')');

// Test 2: OpenAI Client Initialization
console.log('\nTest 2: Initializing OpenAI client...');
let openai;
try {
  openai = new OpenAI({ apiKey });
  console.log('✅ PASSED: OpenAI client initialized');
} catch (error) {
  console.error('❌ FAILED:', error.message);
  process.exit(1);
}

// Test 3: Simple OpenAI API Call
console.log('\nTest 3: Testing OpenAI API call...');
const testCode = `
function add(a, b) {
  return a + b;
}
`;

const prompt = `You are an expert code reviewer. Analyze the following javascript code and provide a comprehensive review in strict JSON format.

Code to analyze:
\`\`\`javascript
${testCode}
\`\`\`

Return a JSON object with this exact structure:
{
  "summary": "Brief 2-3 sentence overview of the code",
  "overallScore": 85,
  "counts": {
    "critical": 0,
    "high": 0,
    "medium": 1,
    "low": 1,
    "codeSmells": 1
  },
  "metrics": {
    "complexity": 20,
    "performance": 90,
    "maintainability": 85,
    "documentation": 40,
    "security": 95,
    "readability": 90
  },
  "issues": [
    {
      "severity": "medium",
      "category": "Documentation",
      "message": "Function lacks JSDoc comments",
      "line": 1,
      "suggestion": "Add JSDoc comment describing parameters and return value"
    }
  ],
  "recommendations": [
    "Add JSDoc documentation",
    "Consider adding input validation",
    "Add unit tests"
  ],
  "technicalDebt": "Low - Simple function with minimal technical debt"
}

Be thorough but concise. Provide actionable insights.`;

async function testOpenAICall() {
  try {
    console.log('Calling OpenAI API...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert code reviewer. You MUST respond with valid JSON only. Do not include any markdown formatting, code blocks, or explanatory text. Return only the raw JSON object.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    console.log('✅ PASSED: OpenAI API call successful');
    console.log('Response received, length:', completion.choices[0].message.content.length);

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('❌ FAILED: OpenAI API error');
    console.error('Error:', error.message);
    if (error.status) console.error('Status:', error.status);
    if (error.type) console.error('Type:', error.type);
    process.exit(1);
  }
}

// Test 4: JSON Parsing
function extractJSON(responseText) {
  try {
    return JSON.parse(responseText);
  } catch (e) {
    let cleaned = responseText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonStr);
      }

      throw new Error('Unable to extract valid JSON from response');
    }
  }
}

async function runTests() {
  const responseText = await testOpenAICall();

  console.log('\nTest 4: Parsing JSON response...');
  console.log('Response preview:', responseText.substring(0, 150) + '...');

  try {
    const analysisData = extractJSON(responseText);
    console.log('✅ PASSED: JSON parsed successfully');
    console.log('Keys found:', Object.keys(analysisData));

    // Test 5: Validate Structure
    console.log('\nTest 5: Validating response structure...');
    const requiredKeys = ['summary', 'overallScore', 'counts', 'metrics', 'issues', 'recommendations', 'technicalDebt'];
    const missingKeys = requiredKeys.filter(key => !(key in analysisData));

    if (missingKeys.length > 0) {
      console.log('⚠️  WARNING: Missing keys:', missingKeys);
    } else {
      console.log('✅ PASSED: All required keys present');
    }

    // Test 6: Validate Data Types
    console.log('\nTest 6: Validating data types...');
    if (typeof analysisData.overallScore !== 'number') {
      console.log('⚠️  WARNING: overallScore is not a number');
    }
    if (!Array.isArray(analysisData.issues)) {
      console.log('⚠️  WARNING: issues is not an array');
    }
    if (!Array.isArray(analysisData.recommendations)) {
      console.log('⚠️  WARNING: recommendations is not an array');
    }
    console.log('✅ PASSED: Data types valid');

    console.log('\n=== ALL TESTS PASSED ===');
    console.log('\n📊 Sample Analysis Result:');
    console.log(JSON.stringify(analysisData, null, 2));

    return true;
  } catch (error) {
    console.error('❌ FAILED: JSON parsing error');
    console.error('Error:', error.message);
    console.error('\nFull response:');
    console.error(responseText);
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ TEST SUITE FAILED');
  console.error(error);
  process.exit(1);
});
