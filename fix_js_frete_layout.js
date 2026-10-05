const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /const totalFooter = parsedItens && parsedItens\.length > 0 \? `([\s\S]*?)` : '';/;

const replacement = `const bgCorSub = freteVal > 0 ? '#f8fafc' : '#f0fdf4';
        const txtCorSub = freteVal > 0 ? '#475569' : '#15803d';

        const totalFooter = parsedItens && parsedItens.length > 0 ? \`
            <tr style="background:\${bgCorSub};">
                <td colspan="2" style="padding:12px 14px;font-weight:700;font-size:13px;color:\${txtCorSub};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #4b5563; font-size: 12px; font-weight: normal;">Peso Total: <b style="color: #1e293b;">\${totalPeso.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})} kg</b></span>
                        <span>\${freteVal > 0 ? 'Total Itens:' : 'Valor Total:'}</span>
                    </div>
                </td>
                <td style="padding:12px 14px;font-weight:700;font-size:14px;color:\${txtCorSub};text-align:right;">\${fmtBRL(totalValor)}</td>
            </tr>
            \${freteVal > 0 ? \`
            <tr style="background:#f8fafc; border-top: 1px solid #e2e8f0;">
                <td colspan="2" style="padding:8px 14px;font-weight:700;font-size:13px;color:#475569; text-align: right;">
                    Frete:
                </td>
                <td style="padding:8px 14px;font-weight:700;font-size:14px;color:#475569;text-align:right;">
                    \${fmtBRL(freteVal)}
                </td>
            </tr>
            <tr style="background:#dcfce7; border-top: 1px solid #bbf7d0;">
                <td colspan="2" style="padding:12px 14px;font-weight:700;font-size:14px;color:#166534; text-align: right;">
                    Valor Total:
                </td>
                <td style="padding:12px 14px;font-weight:700;font-size:15px;color:#166534;text-align:right;">
                    \${fmtBRL(totalComFrete)}
                </td>
            </tr>
            \` : ''}
        \` : '';`;

js = js.replace(regex, replacement);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Layout do frete ajustado!');
