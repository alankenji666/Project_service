const fs = require('fs');
let js = fs.readFileSync('js/modulos/dashboard.js', 'utf8');

if (!js.includes('import { API_URLS }')) {
    js = "import { API_URLS } from '../apiConfig.js?v=22';\n" + js;
    fs.writeFileSync('js/modulos/dashboard.js', js);
    console.log('Import adicionado!');
} else {
    console.log('Import ja existe.');
}
