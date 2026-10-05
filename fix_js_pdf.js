const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// The replacement script
const regex = /win\.document\.close\(\);\s*\}/;
const replacement = `win.document.close();
    }

    async function _handleDownloadSatG() {
        if (!_currentSatgRowIndex) return;
        const req = _satgData.find(d => d.rowIndex === _currentSatgRowIndex);
        if (!req) return;

        const btn = document.getElementById('modal-satg-download-btn');
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = \`<svg class="animate-spin h-4 w-4 text-indigo-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Gerando...\`;
            btn.disabled = true;
        }

        let htmlEnvio = '';
        if (req.idPedido) {
            const pedido = _pedidosGarantiaData.find(p => String(p.id) === String(req.idPedido) || String(p.numero) === String(req.idPedido));
            if (pedido && pedido.transportadora) {
                let nomeTransp = pedido.transportadora;
                if (typeof _listaTransportadoras !== 'undefined') {
                    const foundTransp = _listaTransportadoras.find(t => String(t.codigo) === String(pedido.transportadora));
                    if (foundTransp) nomeTransp = foundTransp.nome;
                }
                
                const fullEndereco = \`\${pedido.endereco || '-'}, \${pedido.numeroEndereco || '-'} \${pedido.complemento ? ' - ' + pedido.complemento : ''} - \${pedido.bairro || '-'}, \${pedido.cidade || '-'}/\${pedido.estado || '-'} - CEP: \${pedido.cep || '-'}\`;
                let emb = pedido.embalagem || 'Nenhuma';
                if (emb !== 'Nenhuma' && emb.includes('/')) {
                    const p = emb.split('/');
                    if (p.length === 4) {
                        emb = \`\${p[0]} - \${p[1]}x\${p[2]}x\${p[3]}\`;
                    }
                }
                const vol = pedido.volume ? \` (\${pedido.volume} Vol)\` : '';

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

        const wrapper = document.createElement('div');
        wrapper.innerHTML = \`
            <style>
                .pdf-body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; background: white; }
                .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #ddd; }
                .header h1 { margin: 0; color: #4F46E5; }
                .header p { margin: 5px 0; color: #666; }
                .section { margin-bottom: 15px; }
                .section-title { font-size: 13px; text-transform: uppercase; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 10px; }
                .grid { display: flex; flex-wrap: wrap; gap: 10px; }
                .field { flex: 1; min-width: auto; background: #f9f9f9; padding: 6px 10px; border-radius: 5px; }
                .field-label { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 2px; display: block; font-weight: bold; }
                .field-value { font-size: 13px; font-weight: bold; }
                .problema-box { background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 5px; margin-top: 10px; }
                .problema-label { font-size: 10px; text-transform: uppercase; color: #dc2626; margin-bottom: 2px; display: block; font-weight: bold; }
            </style>
            <div class="pdf-body">
                <div class="header">
                    <h1>Solicitação de Garantia SAT-G</h1>
                    <p>Código: <b>\${req.codigo || '-'}</b> &nbsp;|&nbsp; Data: <b>\${req.data ? req.data.split(' ')[0] : '-'}</b></p>
                </div>
                
                <div class="section">
                    <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Dados do Cliente</span>
                        <span style="font-size: 11px; font-weight: normal; color: #4b5563; text-transform: uppercase;">Cód. Cliente: <b style="color: #111827;">\${req.codigoCliente || '-'}</b></span>
                    </div>
                    <div class="grid" style="margin-bottom: 15px;">
                        <div class="field" style="flex: 1;">
                            <span class="field-label">Cliente / Empresa</span>
                            <span class="field-value">\${req.cliente || '-'}</span>
                        </div>
                    </div>
                    <div class="grid">
                        <div class="field" style="flex: 1; min-width: 140px;">
                            <span class="field-label">CPF / CNPJ</span>
                            <span class="field-value">\${req.cpf || '-'}</span>
                        </div>
                        <div class="field" style="flex: 1; min-width: 140px;">
                            <span class="field-label">Telefone / WhatsApp</span>
                            <span class="field-value">\${req.telefone || '-'}</span>
                        </div>
                        <div class="field" style="flex: 1.5; min-width: 150px;">
                            <span class="field-label">E-mail</span>
                            <span class="field-value">\${req.email || '-'}</span>
                        </div>
                    </div>
                </div>

                \${htmlEnvio}

                <div class="section">
                    <div class="section-title">Equipamento com Defeito</div>
                    <div class="grid">
                        <div class="field" style="flex: 2;">
                            <span class="field-label">Equipamento (Modelo e Ano)</span>
                            <span class="field-value">\${req.equipamento || '-'}</span>
                        </div>
                        <div class="field">
                            <span class="field-label">Nº Série</span>
                            <span class="field-value">\${req.numeroSerie || '-'}</span>
                        </div>
                        <div class="field">
                            <span class="field-label">Nota Fiscal</span>
                            <span class="field-value">\${req.notaFiscal || '-'}</span>
                        </div>
                    </div>
                    
                    <div class="problema-box">
                        <span class="problema-label">Problema Detalhado</span>
                        <div style="font-size: 14px; white-space: pre-wrap;">\${req.problema || '-'}</div>
                    </div>
                    
                    <div class="problema-box" style="background: #f8fafc; border-color: #cbd5e1; margin-top: 15px;">
                        <span class="problema-label" style="color: #475569;">Avaliação Interna (Constatação do Problema) *</span>
                        <div style="font-size: 14px; white-space: pre-wrap;">\${req.observacao || '-'}</div>
                    </div>
                </div>
                
                \${_getPedidoPrintHtml(req.idPedido)}
            </div>
        \`;

        const filename = \`SAT-G: \${req.codigo || '0000'} - \${req.cliente || 'Empresa'}.pdf\`;

        if (typeof html2pdf !== 'undefined') {
            html2pdf().set({
                margin:       10,
                filename:     filename,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(wrapper).save().then(() => {
                if (btn) {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            }).catch(err => {
                console.error("Erro ao gerar PDF:", err);
                alert("Erro ao gerar PDF.");
                if (btn) {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            });
        } else {
            alert('A biblioteca html2pdf não foi carregada. Tente recarregar a página.');
            if (btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        }
    }`;

js = js.replace(regex, replacement);

const bindRegex = /_modalSatgPrintBtn\.onclick = \(e\) => \{/;
const bindReplacement = `
        const modalSatgDownloadBtn = document.getElementById('modal-satg-download-btn');
        if (modalSatgDownloadBtn) {
            modalSatgDownloadBtn.onclick = (e) => {
                e.preventDefault();
                _handleDownloadSatG();
            };
        }

        _modalSatgPrintBtn.onclick = (e) => {`;
js = js.replace(bindRegex, bindReplacement);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Função de download PDF adicionada com sucesso!');
