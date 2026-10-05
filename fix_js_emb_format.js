const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /const emb = pedido\.embalagem \|\| 'Nenhuma';\s*const vol = pedido\.volume \? ` \(\$\{pedido\.volume\} vol\)` : '';/;

const replacement = `let emb = pedido.embalagem || 'Nenhuma';
                if (emb !== 'Nenhuma' && emb.includes('/')) {
                    const p = emb.split('/');
                    if (p.length === 4) {
                        emb = \`\${p[0]} - \${p[1]}x\${p[2]}x\${p[3]}\`;
                    }
                }
                const vol = pedido.volume ? \` (\${pedido.volume} Vol)\` : '';`;

js = js.replace(regex, replacement);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Formato da Embalagem / Vol atualizado!');
