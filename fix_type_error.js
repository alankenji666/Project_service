const fs = require('fs');
let js = fs.readFileSync('js/main.js', 'utf8');

// The replacement should happen inside _confirmTerceirosRequisition and potentially inside _handleLaunchRequisition if I want to be safe,
// but inside _handleLaunchRequisition, 'type' IS defined. So I'll only replace the one that causes the bug.
// Actually, I can just replace all of them to use 'type' safely if it exists, or 'PENDENTE' if it's in terceiros.
// Let's explicitly fix the one in _confirmTerceirosRequisition.

const targetCode = `                        const product = _allProducts.find(p => p.id === productId);
                        return {
                            id: product.id, codigo: product.codigo, descricao: product.descricao, quantidade: qty,
                            unidade: product.unidade || 'UN', preco: product.preco || 0,
                            localizacao: product.localizacao || '',
                            situacao: type === 'fabrica' ? 'Criado' : 'PENDENTE'
                        };`;

const replacement = `                        const product = _allProducts.find(p => p.id === productId);
                        return {
                            id: product.id, codigo: product.codigo, descricao: product.descricao, quantidade: qty,
                            unidade: product.unidade || 'UN', preco: product.preco || 0,
                            localizacao: product.localizacao || '',
                            situacao: 'PENDENTE' // Corrigido erro de escopo do type (sempre é PENDENTE para terceiros)
                        };`;

// We have to be careful not to replace it in _handleLaunchRequisition where type is defined.
// Wait, `type === 'fabrica'` is perfectly fine there, but the problem is ONLY in _confirmTerceirosRequisition.
// So let's replace the one inside `async function _confirmTerceirosRequisition()`:

const fullRegex = /async function _confirmTerceirosRequisition\(\) \{[\s\S]*?situacao: type === 'fabrica' \? 'Criado' : 'PENDENTE'[\s\S]*?\};/m;

js = js.replace(fullRegex, (match) => {
    return match.replace("situacao: type === 'fabrica' ? 'Criado' : 'PENDENTE'", "situacao: 'PENDENTE'");
});

fs.writeFileSync('js/main.js', js);
console.log('Script modificado removendo type não definido');
