const fs = require('fs');
let js = fs.readFileSync('js/modulos/dashboard.js', 'utf8');

const regex = /if \(_dom\.rankingContainer\) _dom\.rankingContainer\.classList\.add\('hidden'\);/;
const replaceStr = `if (_dom.rankingContainer) _dom.rankingContainer.classList.add('hidden');
        if (_dom.garantiaContainer) _dom.garantiaContainer.classList.add('hidden');`;

js = js.replace(regex, replaceStr);

fs.writeFileSync('js/modulos/dashboard.js', js);
console.log('garantiaContainer escondido no _showSelector');
