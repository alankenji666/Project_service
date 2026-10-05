const fs = require('fs');
let js = fs.readFileSync('js/main.js', 'utf8');

const regex1 = /id: product\.id, codigo: product\.codigo, descricao: product\.descricao, quantidade: qty,\s*unidade: product\.unidade \|\| 'UN', preco: product\.preco \|\| 0,\s*situacao: 'PENDENTE' \/\/ Adiciona o status padrão ao criar o item/g;

const replacement1 = `id: product.id, codigo: product.codigo, descricao: product.descricao, quantidade: qty,
                            unidade: product.unidade || 'UN', preco: product.preco || 0,
                            localizacao: product.localizacao || '',
                            situacao: 'PENDENTE' // Adiciona o status padrão ao criar o item`;

js = js.replace(regex1, replacement1);

fs.writeFileSync('js/main.js', js);
console.log('Main.js corrigido para incluir localizacao em itemsToLaunch.');
