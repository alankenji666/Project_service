const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Remove the scoping error from previous edit
const errRegex = /let imgSrc = '';\s*let prodPeso = 0;\s*if \(window\._allProducts\) \{[\s\S]*?prodPeso = parseFloat\(prod\.pesoBruto \|\| prod\.peso \|\| 0\);\s*\}\s*\}/;
const fixImgSrc = `let imgSrc = '';
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
js = js.replace(errRegex, fixImgSrc);

// 2. Fix the loop math error
const errMath = /const precoItem = parseFloat\(i\.preco \|\| 0\);\s*const qtdItem = parseInt\(i\.qtd \|\| 1\);\s*const pesoItem = parseFloat\(i\.peso \|\| i\.pesoBruto \|\| prodPeso \|\| 0\);\s*totalValor \+= \(precoItem \* qtdItem\);\s*totalPeso \+= \(pesoItem \* qtdItem\);/;
const fixMath = `const precoItem = parseFloat(i.preco || 0);
                const qtdItem = parseInt(i.qtd || 1);
                totalValor += (precoItem * qtdItem);`;
js = js.replace(errMath, fixMath);

// 3. Set totalPeso by reading directly from the backend payload (pedido.pesoTotal)
js = js.replace(/let htmlItens = '';\s*let totalValor = 0;\s*let totalPeso = 0;/, `let htmlItens = '';
        let totalValor = 0;
        let totalPeso = parseFloat(pedido.pesoTotal || 0);`); // Pega da planilha direto!

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Frontend corrigido para puxar pesoTotal do BD!');
