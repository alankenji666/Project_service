const fs = require('fs');

let js = fs.readFileSync('js/main.js', 'utf8');

const regex = /function _printReportSolicitation\(\) \{[\s\S]*?\}\s*(?=\/\/\s*NOVO:|\n\s*function _exportReportToCSV)/;

const newImplementation = `function _printReportSolicitation() {
                const productsToPrint = Array.from(_reportQuantities.keys())
                    .filter(productId => (_reportQuantities.get(productId) || 0) > 0)
                    .map(productId => _allProducts.find(p => String(p.id) === String(productId)));

                if (productsToPrint.length === 0) {
                    _showMessageModal("Nenhum Item", "Não há itens com quantidade a requisitar maior que zero para imprimir.");
                    return;
                }

                // Usando o modal genérico para pedir o prazo
                const modal = document.getElementById('modal-generic-edit');
                if (!modal) {
                    // Fallback to window.prompt just in case
                    const ans = window.prompt("Prazo para entrega (em dias):", "5");
                    if (ans !== null) {
                        _executePrintReportSolicitation(productsToPrint, parseInt(ans) || 0);
                    }
                    return;
                }

                const titleEl = document.getElementById('modal-generic-edit-title');
                const labelEl = document.getElementById('modal-generic-edit-label');
                const inputEl = document.getElementById('modal-generic-edit-input');
                const selectEl = document.getElementById('modal-generic-edit-select');
                const btnCancel = document.getElementById('btn-cancel-generic-edit');
                const btnSave = document.getElementById('btn-save-generic-edit');
                const btnClose = document.getElementById('btn-close-generic-edit');

                titleEl.innerText = 'Prazo de Entrega';
                labelEl.innerText = 'Insira o prazo para entrega (em dias):';

                // Clone para limpar eventos anteriores
                const newBtnSave = btnSave.cloneNode(true);
                btnSave.parentNode.replaceChild(newBtnSave, btnSave);
                const newBtnCancel = btnCancel.cloneNode(true);
                btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
                const newBtnClose = btnClose.cloneNode(true);
                btnClose.parentNode.replaceChild(newBtnClose, btnClose);
                const newInput = inputEl.cloneNode(true);
                inputEl.parentNode.replaceChild(newInput, inputEl);

                if (selectEl) selectEl.classList.add('hidden');
                newInput.classList.remove('hidden');
                
                newInput.type = 'number';
                newInput.min = '0';
                newInput.value = '5';

                const closeModal = () => {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                    newInput.type = 'text'; // reset
                };

                const handleSave = () => {
                    const dias = parseInt(newInput.value) || 0;
                    closeModal();
                    _executePrintReportSolicitation(productsToPrint, dias);
                };

                newBtnCancel.addEventListener('click', closeModal);
                newBtnClose.addEventListener('click', closeModal);
                newBtnSave.addEventListener('click', handleSave);

                newInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') closeModal();
                });

                modal.classList.add('flex');
                modal.classList.remove('hidden');
                newInput.focus();
                newInput.select();
            }

            function _executePrintReportSolicitation(productsToPrint, dias) {
                const requisitionModeText = _reportState.isIntelligentMode ? 'Requisição Inteligente' : 'Requisição Padrão';
                const today = new Date();
                const currentDateText = today.toLocaleDateString('pt-BR');
                
                const dataPrevista = new Date(today);
                dataPrevista.setDate(dataPrevista.getDate() + dias);
                const dataPrevistaText = dataPrevista.toLocaleDateString('pt-BR');

                let printHtml = \`
                <div class="solicitation-page">
                    <div class="solicitation-header">
                        <div class="company-name">MKS Service</div>
                        <div class="report-title">Itens de Reposição</div>
                        <div class="solicitation-info">
                            <div><strong>Modo:</strong> \${requisitionModeText}</div>
                            <div><strong>Data da Solicitação:</strong> \${currentDateText}</div>
                            <div><strong>Data Prevista:</strong> \${dataPrevistaText}</div>
                        </div>
                    </div>
                    <table class="solicitation-print-table">
                        <thead><tr><th>Foto</th><th>Produto / Código</th><th>Localização</th><th>Qtd. Solicitada</th></tr></thead>
                        <tbody>\`;

                productsToPrint.forEach(p => {
                    const requestedQty = _reportQuantities.get(p.id) || 0;
                    const imageUrl = p.url_imagens_externas?.[0];
                    const imageHtml = imageUrl
                        ? \`<img src="\${imageUrl}" class="solicitation-product-image" onerror="this.style.display='none'">\`
                        : \`<span style="font-size: 9pt; color: #6b7280;">Sem Imagem</span>\`;
                    printHtml += \`<tr>
                    <td class="photo-cell">\${imageHtml}</td>
                    <td class="product-cell"><strong>\${p.descricao}</strong><br><small>Código: \${p.codigo}</small></td>
                    <td class="location-cell">\${p.localizacao || 'N/A'}</td>
                    <td class="quantity-cell">\${requestedQty}</td>
                </tr>\`;
                });
                printHtml += \`</tbody></table></div>\`;

                if (_printArea) {
                    _printArea.innerHTML = printHtml;
                    window.print();
                    _printArea.innerHTML = '';
                }
            }
`;

if (js.match(regex)) {
    js = js.replace(regex, newImplementation + '\n');
    fs.writeFileSync('js/main.js', js);
    console.log('Botão modificado!');
} else {
    console.log('Regex não encontrou _printReportSolicitation()');
}
