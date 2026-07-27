const fs = require('fs');

async function run() {
    try {
        let data = fs.readFileSync('logs3.json', 'utf16le');
        if (data.charCodeAt(0) === 0xFEFF) {
            data = data.slice(1);
        }
        const logs = JSON.parse(data);
        
        const relevantLogs = logs
            .map(l => l.textPayload || (l.jsonPayload && l.jsonPayload.message) || '')
            .filter(text => text && text.includes('26352824733'));
            
        console.log("RELEVANT LOGS:");
        relevantLogs.forEach(l => console.log(l.trim()));
    } catch (e) {
        console.log("Error reading logs:", e.message);
    }
}
run();
