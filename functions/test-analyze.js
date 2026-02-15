// Test script for analyzeCode endpoint
const testCode = `
function calculateSum(a, b) {
  return a + b;
}
`;

const payload = {
  code: testCode,
  filename: 'test.js',
  uid: 'test-user-123'
};

console.log('Testing analyzeCode endpoint...');
console.log('Payload:', JSON.stringify(payload, null, 2));

fetch('http://127.0.0.1:5001/project-70cbf/us-central1/analyzeCode', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload)
})
  .then(response => {
    console.log('\nResponse status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    return response.json();
  })
  .then(data => {
    console.log('\nResponse data:', JSON.stringify(data, null, 2));
  })
  .catch(error => {
    console.error('\nError:', error.message);
  });
