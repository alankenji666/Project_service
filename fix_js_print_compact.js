const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// 1. Shrink CSS
const cssRegex = /\.header \{ text-align: center; margin-bottom: 30px; padding-bottom: 10px; border-bottom: 2px solid #ddd; \}[\s\S]*?\.problema-label \{ font-size: 11px; text-transform: uppercase; color: #dc2626; margin-bottom: 4px; display: block; font-weight: bold; \}/;
const cssRepl = `.header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #ddd; }
                    .header h1 { margin: 0; color: #4F46E5; }
                    .header p { margin: 5px 0; color: #666; }
                    .section { margin-bottom: 15px; }
                    .section-title { font-size: 13px; text-transform: uppercase; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 10px; }
                    .grid { display: flex; flex-wrap: wrap; gap: 10px; }
                    .field { flex: 1; min-width: auto; background: #f9f9f9; padding: 6px 10px; border-radius: 5px; }
                    .field-label { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 2px; display: block; font-weight: bold; }
                    .field-value { font-size: 13px; font-weight: bold; }
                    .problema-box { background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 5px; margin-top: 10px; }
                    .problema-label { font-size: 10px; text-transform: uppercase; color: #dc2626; margin-bottom: 2px; display: block; font-weight: bold; }`;
js = js.replace(cssRegex, cssRepl);

// 2. Resolve Transportadora Name and rebuild htmlEnvio
const envioRegex = /let htmlEnvio = '';[\s\S]*?const html = `/;
const envioRepl = `let htmlEnvio = '';
        if (req.idPedido) {
            const pedido = _pedidosGarantiaData.find(p => String(p.id) === String(req.idPedido) || String(p.numero) === String(req.idPedido));
            if (pedido && pedido.transportadora) {
                let nomeTransp = pedido.transportadora;
                if (typeof _listaTransportadoras !== 'undefined') {
                    const foundTransp = _listaTransportadoras.find(t => String(t.codigo) === String(pedido.transportadora));
                    if (foundTransp) nomeTransp = foundTransp.nome;
                }
                
                const fullEndereco = \`\${pedido.endereco || '-'}, \${pedido.numeroEndereco || '-'} \${pedido.complemento ? ' - ' + pedido.complemento : ''} - \${pedido.bairro || '-'}, \${pedido.cidade || '-'}/\${pedido.estado || '-'} - CEP: \${pedido.cep || '-'}\`;
                const emb = pedido.embalagem || 'Nenhuma';
                const vol = pedido.volume ? \` (\${pedido.volume} vol)\` : '';

                htmlEnvio = \`
                <div class="section">
                    <div class="section-title">Dados de Envio</div>
                    <div class="grid" style="margin-bottom: 8px;">
                        <div class="field" style="flex: 2;">
                            <span class="field-label">Transportadora</span>
                            <span class="field-value">\${nomeTransp}</span>
                        </div>
                        <div class="field" style="flex: 1;">
                            <span class="field-label">Embalagem / Vol</span>
                            <span class="field-value">\${emb}\${vol}</span>
                        </div>
                        <div class="field" style="flex: 1;">
                            <span class="field-label">Valor Frete</span>
                            <span class="field-value">\${pedido.valorFrete || '-'}</span>
                        </div>
                    </div>
                    <div class="grid">
                        <div class="field" style="flex: 1;">
                            <span class="field-label">Endereço de Entrega Completo</span>
                            <span class="field-value" style="font-size: 12px;">\${fullEndereco}</span>
                        </div>
                    </div>
                </div>
                \`;
            }
        }

        const html = \``;
        
js = js.replace(envioRegex, envioRepl);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Impressão formatada para ocupar menos espaço e resolver nome de transportadora!');
