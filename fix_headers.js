const fs = require('fs');
const path = require('path');
const dir = 'backEndGCloud';

fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => {
    const p = path.join(dir, f);
    let content = fs.readFileSync(p, 'utf8');
    
    // Procura por 'Authorization': `Bearer ${token}` ou variações e adiciona o 'enable-jwt': '1'
    let newContent = content.replace(/'Authorization':\s*`Bearer \$\{([^}]+)\}`/g, `'Authorization': \`Bearer \$\{$1\}\`, 'enable-jwt': '1'`);
    
    if (content !== newContent) {
        fs.writeFileSync(p, newContent);
        console.log('Updated ' + f);
    }
});
