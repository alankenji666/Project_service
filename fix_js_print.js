const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex1 = /const html = `/;
const repl1 = `let htmlEnvio = '';
        if (req.idPedido) {
            const pedido = _pedidosGarantiaData.find(p => String(p.id) === String(req.idPedido) || String(p.numero) === String(req.idPedido));
            if (pedido && pedido.transportadora) {
                htmlEnvio = \`
                <div class="section">
                    <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Dados de Envio</span>
                    </div>
                    <div class="grid" style="margin-bottom: 15px;">
                        <div class="field" style="flex: 2;">
                            <span class="field-label">Transportadora</span>
                            <span class="field-value">\${pedido.transportadora || '-'}</span>
                        </div>
                        <div class="field" style="flex: 1;">
                            <span class="field-label">Volume</span>
                            <span class="field-value">\${pedido.volume || '-'}</span>
                        </div>
                        <div class="field" style="flex: 1;">
                            <span class="field-label">Valor Frete</span>
                            <span class="field-value">\${pedido.valorFrete || '-'}</span>
                        </div>
                    </div>
                    <div class="grid" style="margin-bottom: 15px;">
                        <div class="field" style="flex: 3;">
                            <span class="field-label">Endereço de Entrega</span>
                            <span class="field-value">\${pedido.endereco || '-'}, \${pedido.numeroEndereco || '-'} \${pedido.complemento ? ' - ' + pedido.complemento : ''}</span>
                        </div>
                        <div class="field" style="flex: 1;">
                            <span class="field-label">Bairro</span>
                            <span class="field-value">\${pedido.bairro || '-'}</span>
                        </div>
                        <div class="field" style="flex: 1;">
                            <span class="field-label">CEP</span>
                            <span class="field-value">\${pedido.cep || '-'}</span>
                        </div>
                    </div>
                    <div class="grid">
                        <div class="field" style="flex: 2;">
                            <span class="field-label">Cidade / Estado</span>
                            <span class="field-value">\${pedido.cidade || '-'} - \${pedido.estado || '-'}</span>
                        </div>
                        <div class="field" style="flex: 1.5;">
                            <span class="field-label">Embalagem / Dimensões</span>
                            <span class="field-value">\${pedido.embalagem || '-'}</span>
                        </div>
                    </div>
                </div>
                \`;
            }
        }

        const html = \``;
        
js = js.replace(regex1, repl1);

const regex2 = /<div class="section">\s*<div class="section-title">Equipamento com Defeito<\/div>/;
const repl2 = `\${htmlEnvio}

                <div class="section">
                    <div class="section-title">Equipamento com Defeito</div>`;
js = js.replace(regex2, repl2);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Script de impressão atualizado com dados de envio!');
