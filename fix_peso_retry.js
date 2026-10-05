const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Injetar a lógica de retry no PUT (linha 782-787)
const fetchRegex = /\/\/ IMPORTANTE: Utiliza API_URLS do gerenciarGarantia[\s\S]*?body: JSON\.stringify\(\{ peso_bruto: currentPeso, peso_liquido: currentPeso \}\)\s*\}\);/g;

const retryLogic = `// IMPORTANTE: Utiliza API_URLS do gerenciarGarantia
                            const maxRetries = 3;
                            const retryDelays = [5000, 10000, 15000];
                            let updateSuccess = false;
                            let lastError = null;
                            
                            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                                try {
                                    const res = await fetch(\`\${API_URLS.PRODUCTS}/\${productIdToUpdate}\`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ peso_bruto: currentPeso, peso_liquido: currentPeso })
                                    });
                                    if (res.ok) {
                                        updateSuccess = true;
                                        break; // Success!
                                    }
                                    throw new Error(\`HTTP Error: \${res.status}\`);
                                } catch (err) {
                                    lastError = err;
                                    if (attempt < maxRetries) {
                                        console.warn(\`[Peso] Falha ao atualizar (Tentativa \${attempt + 1}). Retentando em \${retryDelays[attempt]/1000}s...\`);
                                        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
                                    }
                                }
                            }
                            if (!updateSuccess) throw lastError;`;

js = js.replace(fetchRegex, retryLogic);

// 2. Definir _updateUIPesoTotal e chamá-lo
const renderItemsEndRegex = /_itemsList\.appendChild\(tr\);\s*\}\);/g;
const renderItemsEndRepl = `_itemsList.appendChild(tr);
        });
        
        // NOVO: Update visual UI total
        _updateUIPesoTotal();`;
js = js.replace(renderItemsEndRegex, renderItemsEndRepl);

// Definir a função _updateUIPesoTotal de fato
const injectFuncRegex = /function _formatItemsString\(\) \{/g;
const injectFuncRepl = `function _updateUIPesoTotal() {
        const el = document.getElementById('garantia-peso-total');
        if (!el) return;
        let totalPesoCalc = 0;
        _currentOrderItems.forEach(i => {
            let pPeso = 0;
            if (window._allProducts) {
                const pr = window._allProducts.find(p => String(p.codigo || '').trim() === String(i.id || i.cod).trim());
                if (pr) pPeso = parseFloat(pr.pesoBruto || pr.peso || 0);
            }
            totalPesoCalc += (parseFloat(i.peso || i.pesoBruto || pPeso || 0) * parseInt(i.qtd || 1));
        });
        el.value = totalPesoCalc.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3});
    }

    function _formatItemsString() {`;

js = js.replace(injectFuncRegex, injectFuncRepl);


fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Script ajustado: Dinâmico UI do Peso e Retries API implementados!');
