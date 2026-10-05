const fs = require('fs');
let js = fs.readFileSync('js/modulos/dashboard.js', 'utf8');

// 1. Extract the function
const functionStartIdx = js.lastIndexOf('async function _showGarantiaDashboard() {');
if (functionStartIdx === -1) {
    console.log('Function not found!');
    process.exit(1);
}

// Ensure we get the full function body until the end of the file
const funcCode = js.slice(functionStartIdx);
js = js.slice(0, functionStartIdx);

// 2. Find the correct `return {` of the DashboardApp module
// It is at the end of the file, right before `})();`
const moduleReturnRegex = /return\s*\{\s*init:\s*function\(config\)/;
const match = moduleReturnRegex.exec(js);

if (match) {
    const returnIdx = match.index;
    
    // 3. Inject the function before the return
    js = js.slice(0, returnIdx) + '\n' + funcCode + '\n' + js.slice(returnIdx);
    
    fs.writeFileSync('js/modulos/dashboard.js', js);
    console.log('Function successfully moved into the module scope!');
} else {
    console.log('Could not find module return statement!');
}
