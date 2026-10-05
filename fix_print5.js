const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regexFooter = /const totalFooter = parsedItens && parsedItens\.length > 0 \? `\s*<tr style="background:#f0fdf4;">\s*<td colspan="2" style="padding:12px 14px;font-weight:700;font-size:14px;color:#15803d;">Total<\/td>\s*<td style="padding:12px\s*14px;font-weight:700;font-size:15px;color:#15803d;text-align:right;">\$\{fmtBRL\(totalValor\)\}<\/td>\s*<\/tr>\s*` : '';/s;

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

js = js.replace(regexFooter, newFooter);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Regex 2 applied');
