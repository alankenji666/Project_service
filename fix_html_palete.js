const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<option value="Palet">Palet<\/option>/g;
const replacement = `<option value="Palete">Palete</option>`;

html = html.replace(regex, replacement);
fs.writeFileSync('index.html', html);
console.log('HTML atualizado com Palete!');
