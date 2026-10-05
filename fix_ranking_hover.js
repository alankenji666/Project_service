const fs = require('fs');
let js = fs.readFileSync('js/modulos/dashboard.js', 'utf8');

js = js.replace('tr class="hover:bg-gray-50 transition-colors cursor-pointer group', 'tr class="hover:bg-orange-50 transition-colors cursor-pointer group');

fs.writeFileSync('js/modulos/dashboard.js', js);
console.log('Restored ranking hover');
