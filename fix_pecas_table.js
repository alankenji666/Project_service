const fs = require('fs');
let js = fs.readFileSync('js/modulos/dashboard.js', 'utf8');

// 1. Add pagination state inside the module
const stateRegex = /let _allLojaIntegradaOrders = \[\];/;
if (!js.includes('let _garantiaPecasData = [];')) {
    js = js.replace(stateRegex, "let _allLojaIntegradaOrders = [];\n    let _garantiaPecasData = [];\n    let _garantiaPecasPage = 1;\n    const _garantiaPecasPerPage = 20;");
}

// 2. Modify item parsing to get descricao and codigo
const parsingRegex = /const codDesc = partes\[0\]\.trim\(\);\s*const qtd = parseFloat\(partes\[1\]\) \|\| 0;\s*const precoRaw = partes\[2\]\.split\('\|'\)\[0\];\s*const preco = parseFloat\(precoRaw\) \|\| 0;\s*const custoItem = qtd \* preco;\s*gastoPecas \+= custoItem;\s*if \(!countPecas\[codDesc\]\) countPecas\[codDesc\] = { qtd: 0, custo: 0 };\s*countPecas\[codDesc\]\.qtd \+= qtd;\s*countPecas\[codDesc\]\.custo \+= custoItem;/;

const parsingRepl = `const rawCodDesc = partes[0].trim();
                            const qtd = parseFloat(partes[1]) || 0;
                            const precoRaw = partes[2].split('|')[0];
                            const preco = parseFloat(precoRaw) || 0;
                            const custoItem = qtd * preco;
                            
                            gastoPecas += custoItem;

                            let codigo = rawCodDesc;
                            let descricao = rawCodDesc;
                            if (_allProducts && _allProducts.length > 0) {
                                const pr = _allProducts.find(p => String(p.codigo || '').trim() === rawCodDesc);
                                if (pr) {
                                    descricao = pr.descricao || pr.nome || rawCodDesc;
                                } else {
                                    codigo = '-';
                                }
                            } else {
                                codigo = '-';
                            }
                            
                            const mapKey = descricao + '|||' + codigo;
                            if (!countPecas[mapKey]) countPecas[mapKey] = { descricao, codigo, qtd: 0, custo: 0 };
                            countPecas[mapKey].qtd += qtd;
                            countPecas[mapKey].custo += custoItem;`;

js = js.replace(parsingRegex, parsingRepl);

// 3. Modify the rendering part and implement the renderGarantiaPecasTable function
// First we find the block where it sets topPecas and renders to pecasList.
const renderRegex = /\/\/ Sort Peças Usadas \(by quantity desc\)\s*const topPecas = Object\.entries\(countPecas\)\.sort\(\(a, b\) => b\[1\]\.qtd - a\[1\]\.qtd\);\s*const pecasList = document\.getElementById\('garantia-pecas-list'\);\s*if \(pecasList\) \{\s*pecasList\.innerHTML = topPecas\.map\(\(\[name, data\]\) => `[\s\S]*?`\)\.join\(''\);\s*\}/;

const renderRepl = `// Sort Peças Usadas (by quantity desc)
            _garantiaPecasData = Object.values(countPecas).sort((a, b) => b.qtd - a.qtd);
            _garantiaPecasPage = 1;
            
            // Render pagination and table
            _renderGarantiaPecasTable();`;

js = js.replace(renderRegex, renderRepl);

// 4. Inject _renderGarantiaPecasTable function before _showGarantiaDashboard
const targetFunc = "async function _showGarantiaDashboard() {";
const renderFuncStr = `
    function _renderGarantiaPecasTable() {
        const pecasList = document.getElementById('garantia-pecas-list');
        const info = document.getElementById('garantia-pecas-pagination-info');
        const prevBtn = document.getElementById('garantia-pecas-prev-btn');
        const nextBtn = document.getElementById('garantia-pecas-next-btn');
        const pageText = document.getElementById('garantia-pecas-page-text');

        if (!pecasList) return;

        const totalItems = _garantiaPecasData.length;
        const totalPages = Math.ceil(totalItems / _garantiaPecasPerPage) || 1;
        
        if (_garantiaPecasPage > totalPages) _garantiaPecasPage = totalPages;
        if (_garantiaPecasPage < 1) _garantiaPecasPage = 1;

        const startIndex = (_garantiaPecasPage - 1) * _garantiaPecasPerPage;
        const endIndex = Math.min(startIndex + _garantiaPecasPerPage, totalItems);
        const pageData = _garantiaPecasData.slice(startIndex, endIndex);

        const fmtBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        pecasList.innerHTML = pageData.map(data => \`
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3">
                    <div class="font-bold text-gray-800 text-sm">\${data.descricao}</div>
                    <div class="text-xs font-semibold text-gray-400 mt-0.5">\${data.codigo}</div>
                </td>
                <td class="px-4 py-3 text-center"><span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">\${data.qtd} un</span></td>
                <td class="px-4 py-3 text-right font-bold text-blue-600">\${fmtBRL(data.custo)}</td>
            </tr>
        \`).join('');

        if (info) info.innerText = \`Mostrando \${totalItems === 0 ? 0 : startIndex + 1} a \${endIndex} de \${totalItems} itens\`;
        if (pageText) pageText.innerText = \`Página \${_garantiaPecasPage} de \${totalPages}\`;

        if (prevBtn) {
            prevBtn.disabled = _garantiaPecasPage === 1;
            prevBtn.onclick = () => {
                _garantiaPecasPage--;
                _renderGarantiaPecasTable();
            };
        }
        if (nextBtn) {
            nextBtn.disabled = _garantiaPecasPage === totalPages;
            nextBtn.onclick = () => {
                _garantiaPecasPage++;
                _renderGarantiaPecasTable();
            };
        }
    }
`;

if (!js.includes('function _renderGarantiaPecasTable() {')) {
    js = js.replace(targetFunc, renderFuncStr + '\n' + targetFunc);
}

fs.writeFileSync('js/modulos/dashboard.js', js);
console.log('Modified dashboard.js successfully');
