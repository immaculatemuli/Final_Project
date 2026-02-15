
// No import needed for fetch in Node 18+

async function testFixCode() {
    const fixUrl = 'http://127.0.0.1:5001/project-70cbf/us-central1/fixCode';
    const listUrl = 'http://127.0.0.1:5001/project-70cbf/us-central1/listRecentAnalyses';

    // Test fixCode
    const payload = {
        code: "function add(a, b) { return a + b",
        issues: [{ severity: "critical", message: "Missing closing brace", line: 1 }],
        language: "javascript",
        uid: "test-user"
    };

    try {
        console.log(`Testing fixCode at ${fixUrl}...`);
        const response = await fetch(fixUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Status: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Body:', text);
        } else {
            const data = await response.json();
            console.log('Success! Fixed Code:', data.fixedCode);
        }

    } catch (error) {
        console.error('Error testing fixCode:', error);
    }

    // Test listRecentAnalyses to verify emulator health
    try {
        console.log(`\nTesting listRecentAnalyses at ${listUrl}...`);
        const params = new URLSearchParams({ uid: 'test-user', limit: '1' });
        const response = await fetch(`${listUrl}?${params}`, { method: 'GET' });

        if (!response.ok) {
            console.error(`Health Check Status: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Body:', text);
        } else {
            const data = await response.json();
            console.log('Health Check Success! Functions are running. Count:', data.count);
        }
    } catch (error) {
        console.error('Health Check Error:', error);
    }
}

testFixCode();
