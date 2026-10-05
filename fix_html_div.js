const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<\/div>\s*<\/div>\s*<\/div>\s*<div class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-4 flex-wrap">/g;

if (regex.test(html)) {
    html = html.replace(regex, `</div>\n                    </div>\n                    \n                    <div class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-4 flex-wrap">`);
    fs.writeFileSync('index.html', html);
    console.log('Fixed extra div via script!');
} else {
    console.log('Regex not found!');
}
