const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /const totalFooter = parsedItens && parsedItens\.length > 0 \? `([\s\S]*?)` : '';/;

const replacement = `let freteVal = 0;
        if (pedido.valorFrete) {
            let fStr = String(pedido.valorFrete).replace(/\\./g, '').replace(',', '.').replace(/[^\\d.-]/g, '');
            freteVal = parseFloat(fStr) || 0;
        }
        const totalComFrete = totalValor + freteVal;

        const totalFooter = parsedItens && parsedItens.length > 0 ? \`
            <tr style="background:#f0fdf4;">
                <td colspan="2" style="padding:12px 14px;font-weight:700;font-size:14px;color:#15803d;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #4b5563; font-size: 12px; font-weight: normal;">Peso Total: <b style="color: #1e293b;">\${totalPeso.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})} kg</b></span>
                        <span>Valor Total:</span>
                    </div>
                </td>
                <td style="padding:12px 14px;font-weight:700;font-size:15px;color:#15803d;text-align:right;">\${fmtBRL(totalValor)}</td>
            </tr>
            \${freteVal > 0 ? \`
            <tr style="background:#dcfce7; border-top: 1px solid #bbf7d0;">
                <td colspan="2" style="padding:12px 14px;font-weight:700;font-size:14px;color:#166534; text-align: right;">
                    Valor Total com Frete:
                </td>
                <td style="padding:12px 14px;font-weight:700;font-size:15px;color:#166534;text-align:right;">
                    \${fmtBRL(totalComFrete)}
                </td>
            </tr>
            \` : ''}
        \` : '';`;

js = js.replace(regex, replacement);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Total com frete adicionado!');
