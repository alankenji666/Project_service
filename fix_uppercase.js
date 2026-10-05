const fs = require('fs');
let c = fs.readFileSync('js/main.js', 'utf8');

c = c.replace(/<span class="w-2 h-2 rounded-full \$\{dotColor\}"><\/span>\$\{s\}<\/button>/g, '<span class="w-2 h-2 rounded-full ${dotColor}"></span>${s.toUpperCase()}</button>');

fs.writeFileSync('js/main.js', c);
console.log('Uppercase applied!');
