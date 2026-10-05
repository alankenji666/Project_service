const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Inserir let totalPeso = 0;
js = js.replace(/let htmlItens = '';\s*let totalValor = 0;/, "let htmlItens = '';\n        let totalValor = 0;\n        let totalPeso = 0;");

// 2. Inserir calculo de prodPeso e somar
const imgHtmlMatch = `let imgSrc = '';
                if (window._allProducts) {
                    const prod = window._allProducts.find(p => String(p.codigo || '').trim() === itemRef);
                    if (prod) {
                        if (prod.url_imagens_externas && prod.url_imagens_externas.length > 0) {
                            imgSrc = prod.url_imagens_externas[0];
                        } else if (prod.imagem) {
                            imgSrc = prod.imagem;
                        }
                    }
                }`;
const newImgHtmlMatch = `let imgSrc = '';
                let prodPeso = 0;
                if (window._allProducts) {
                    const prod = window._allProducts.find(p => String(p.codigo || '').trim() === itemRef);
                    if (prod) {
                        if (prod.url_imagens_externas && prod.url_imagens_externas.length > 0) {
                            imgSrc = prod.url_imagens_externas[0];
                        } else if (prod.imagem) {
                            imgSrc = prod.imagem;
                        }
                        prodPeso = parseFloat(prod.pesoBruto || prod.peso || 0);
                    }
                }`;
js = js.replace(imgHtmlMatch, newImgHtmlMatch);

js = js.replace(/const precoItem = parseFloat\(i\.preco \|\| 0\);\s*const qtdItem = parseInt\(i\.qtd \|\| 1\);\s*totalValor \+= \(precoItem \* qtdItem\);/, `const precoItem = parseFloat(i.preco || 0);
                const qtdItem = parseInt(i.qtd || 1);
                const pesoItem = parseFloat(i.peso || i.pesoBruto || prodPeso || 0);
                totalValor += (precoItem * qtdItem);
                totalPeso += (pesoItem * qtdItem);`);

// 3. Atualizar o totalFooter
const oldFooter = `const totalFooter = parsedItens && parsedItens.length > 0 ? \`
            <tr style="background:#f0fdf4;">
                <td colspan="2" style="padding:12px 14px;font-weight:700;font-size:14px;color:#15803d;">Total</td>
                <td style="padding:12px 14px;font-weight:700;font-size:15px;color:#15803d;text-align:right;">\${fmtBRL(totalValor)}</td>
            </tr>
        \` : '';`;

const newFooter = `const totalFooter = parsedItens && parsedItens.length > 0 ? \`
            <tr style="background:#f0fdf4;">
                <td colspan="2" style="padding:12px 14px;font-weight:700;font-size:14px;color:#15803d;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #4b5563; font-size: 12px; font-weight: normal;">Peso Total: <b style="color: #1e293b;">\${totalPeso.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})} kg</b></span>
                        <span>Valor Total:</span>
                    </div>
                </td>
                <td style="padding:12px 14px;font-weight:700;font-size:15px;color:#15803d;text-align:right;">\${fmtBRL(totalValor)}</td>
            </tr>
        \` : '';`;
js = js.replace(oldFooter, newFooter);

// 4. Remover a borda pontilhada
const oldBorder = `<div class="section" style="margin-top: 40px; border-top: 2px dashed #ccc; padding-top: 30px;">`;
const newBorder = `<div class="section" style="margin-top: 40px;">`;
js = js.replace(oldBorder, newBorder);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Impressão do Orçamento finalizada!');
