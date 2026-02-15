// Test script to verify the analysis flow
const testCode = `
function calculateSum(a, b) {
  return a + b;
}

// Missing error handling
// No input validation
console.log(calculateSum(5, 3));
`;

async function testAnalysis() {
  console.log('Testing code analysis...\n');

  try {
    const response = await fetch('http://127.0.0.1:5001/project-70cbf/us-central1/analyzeCode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-123'
      },
      body: JSON.stringify({
        code: testCode,
        language: 'javascript',
        uid: 'test-user-123',
        filename: 'test.js'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Analysis failed');
    }

    const data = await response.json();

    console.log('✅ Analysis successful!');
    console.log('\n📊 Response structure:');
    console.log('- success:', data.success);
    console.log('- analysisId:', data.analysisId);
    console.log('- analysis.overallScore:', data.analysis?.overallScore);
    console.log('- analysis.language:', data.analysis?.language);
    console.log('- analysis.issues.length:', data.analysis?.issues?.length);
    console.log('- analysis.recommendations.length:', data.analysis?.recommendations?.length);

    console.log('\n📝 Analysis Summary:');
    console.log('Score:', data.analysis?.overallScore + '%');
    console.log('Total Issues:', data.analysis?.summary?.totalIssues);
    console.log('Critical Issues:', data.analysis?.summary?.criticalIssues);
    console.log('High Issues:', data.analysis?.summary?.highIssues);

    console.log('\n💡 Recommendations:');
    data.analysis?.recommendations?.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });

    console.log('\n🔥 First few issues:');
    data.analysis?.issues?.slice(0, 3).forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.severity}] ${issue.message}`);
    });

    if (data.analysisId) {
      console.log('\n✅ Analysis was saved to Firestore with ID:', data.analysisId);
    } else {
      console.log('\n⚠️ Analysis was not saved to Firestore (no analysisId returned)');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Firebase emulator is running (firebase emulators:start)');
    console.error('2. OpenAI API key is set in functions/.env');
    console.error('3. Port 5001 is accessible');
    process.exit(1);
  }
}

testAnalysis();
