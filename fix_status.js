const fs = require('fs');
let js = fs.readFileSync('js/main.js', 'utf8');

// 1. Modificar isOk
js = js.replace(/const isOk = itemStatus === 'ok';/g, "const isOk = itemStatus === 'ok' || itemStatus === 'finalizado';");

// 2. Modificar geração de statusHtml
const statusBlockRegex = /if \(isOk\) \{\s*statusHtml = _createOrderStatusPill\('ok', 'OK'\);\s*rowClass = 'row-ok';\s*\} else \{ \/\/ Para 'PENDENTE' ou qualquer outro status não-OK\s*if \(diasAtrasadosUteis > 0\) \{\s*statusHtml = _createOrderStatusPill\('overdue', statusText\);\s*rowClass = 'row-overdue';\s*\} else \{\s*statusHtml = _createOrderStatusPill\('pending', statusText\);\s*rowClass = 'row-pending';\s*\}\s*\}/;

const newStatusBlock = `if (item.requisitionType === 'fabrica') {
                            if (isOk) {
                                statusHtml = _createOrderStatusPill('ok', statusText);
                                rowClass = 'row-ok';
                            } else {
                                statusHtml = \`<select class="fabrica-status-select text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-yellow-50 text-yellow-800" data-order-code="\${item.orderCode}" data-codigo-service="\${item.codigoService}">
                                    <option value="Criado" \${itemStatus === 'criado' || itemStatus === 'pendente' ? 'selected' : ''}>Criado</option>
                                    <option value="Em Produção" \${itemStatus === 'em produção' || itemStatus === 'em producao' ? 'selected' : ''}>Em Produção</option>
                                    <option value="Finalizado">Finalizado</option>
                                </select>\`;
                                rowClass = diasAtrasadosUteis > 0 ? 'row-overdue' : 'row-pending';
                            }
                        } else {
                            if (isOk) {
                                statusHtml = _createOrderStatusPill('ok', 'OK');
                                rowClass = 'row-ok';
                            } else {
                                if (diasAtrasadosUteis > 0) {
                                    statusHtml = _createOrderStatusPill('overdue', statusText);
                                    rowClass = 'row-overdue';
                                } else {
                                    statusHtml = _createOrderStatusPill('pending', statusText);
                                    rowClass = 'row-pending';
                                }
                            }
                        }`;

js = js.replace(statusBlockRegex, newStatusBlock);

// 3. Adicionar lógica do select (logo depois dos checkboxes)
const checkboxListenerRegex = /_ordersTableContent\.querySelectorAll\('\.order-item-checkbox'\)\.forEach\(checkbox => \{\s*checkbox\.addEventListener\('change', \(event\) => \{\s*const \{ orderCode, codigoService, requisitionType \} = event\.target\.dataset;\s*_handleItemStatusChange\(orderCode, codigoService, requisitionType, event\.target\);\s*\}\);\s*\}\);/;

const newListener = `_ordersTableContent.querySelectorAll('.order-item-checkbox').forEach(checkbox => {
                        checkbox.addEventListener('change', (event) => {
                            const { orderCode, codigoService, requisitionType } = event.target.dataset;
                            _handleItemStatusChange(orderCode, codigoService, requisitionType, event.target);
                        });
                    });

                    _ordersTableContent.querySelectorAll('.fabrica-status-select').forEach(selectElem => {
                        selectElem.addEventListener('change', async (event) => {
                            const newStatus = event.target.value;
                            const { orderCode, codigoService } = event.target.dataset;
                            const requisitionType = 'fabrica';
                            
                            if (newStatus === 'Finalizado') {
                                // Revert visually to allow the _handleItemStatusChange to handle the transition normally
                                event.target.value = Array.from(event.target.options).find(o => o.defaultSelected)?.value || 'Criado';
                                
                                // Call the exact same logic as checking the checkbox
                                const checkbox = event.target.closest('tr').querySelector('.order-item-checkbox');
                                if (checkbox) {
                                    checkbox.checked = true;
                                    _handleItemStatusChange(orderCode, codigoService, requisitionType, checkbox);
                                }
                            } else if (newStatus === 'Em Produção') {
                                // Trigger generic prompt for Responsável
                                _openGenericPrompt("Responsável", "Insira o nome do responsável:", async (ans) => {
                                    if (!ans) {
                                        event.target.value = 'Criado';
                                        return;
                                    }
                                    
                                    _loadingOverlay.classList.remove('hidden');
                                    try {
                                        // 1. Atualizar a planilha de Requisicao Fabrica
                                        const updateOrderRes = await fetch(API_URLS.ORDERS_UPDATE, {
                                            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                orderCode, codigoService, newStatus: 'Em Produção', requisitionType
                                            })
                                        });
                                        if (!updateOrderRes.ok) throw new Error("Erro ao atualizar status na requisição");

                                        // 2. Enviar para LinhaProducao
                                        const linhaPayload = {
                                            pedidoId: orderCode,
                                            itemCodigo: codigoService,
                                            newStatus: 'Em Produção',
                                            itemIndex: 1,
                                            newDescription: '',
                                            responsavel: ans,
                                            numeroPedido: orderCode,
                                            quantidade: event.target.closest('tr').querySelector('td:nth-child(5)')?.textContent?.trim() || 1
                                        };
                                        const linhaRes = await fetch(API_URLS.UPDATE_ITEM_STATUS, {
                                            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(linhaPayload)
                                        });
                                        // ignorar falha da linha producao se der erro pq a planilha as vezes ta ruim
                                        
                                        const targetItem = _allOrdersFabrica.flatMap(o => o.rawItems).find(i => i.orderCode === orderCode && i.codigoService === codigoService);
                                        if (targetItem) targetItem.situacao = 'Em Produção';
                                        
                                        _showMessageModal("Sucesso", "Status alterado para Em Produção e enviado para a Linha de Produção.");
                                    } catch (e) {
                                        _showMessageModal("Erro", "Erro ao mudar status: " + e.message);
                                        event.target.value = 'Criado';
                                    } finally {
                                        _loadingOverlay.classList.add('hidden');
                                        _renderConsolidatedOrdersTable();
                                    }
                                }, "text");
                            } else if (newStatus === 'Criado') {
                                _loadingOverlay.classList.remove('hidden');
                                try {
                                    const updateOrderRes = await fetch(API_URLS.ORDERS_UPDATE, {
                                        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            orderCode, codigoService, newStatus: 'Criado', requisitionType
                                        })
                                    });
                                    if (!updateOrderRes.ok) throw new Error("Erro ao atualizar status");
                                    const targetItem = _allOrdersFabrica.flatMap(o => o.rawItems).find(i => i.orderCode === orderCode && i.codigoService === codigoService);
                                    if (targetItem) targetItem.situacao = 'Criado';
                                } catch (e) {
                                    _showMessageModal("Erro", "Erro ao mudar status: " + e.message);
                                } finally {
                                    _loadingOverlay.classList.add('hidden');
                                    _renderConsolidatedOrdersTable();
                                }
                            }
                        });
                    });`;

js = js.replace(checkboxListenerRegex, newListener);

// 4. Mudar o default de launch
js = js.replace(/situacao: 'PENDENTE' \/\/ Adiciona o status padrão ao criar o item/g, "situacao: type === 'fabrica' ? 'Criado' : 'PENDENTE'");

// 5. Precisamos garantir que a função _openGenericPrompt que acabamos de adicionar, exista no escopo. 
// Na verdade eu já fiz um fallback usando prompt manual em outra parte ou algo similar, vamos criar um pequeno helper no escopo do main se nao existir.
// Wait, no _openGenericPrompt eu posso usar o _openCustomPrompt que já fiz? Mas o _openCustomPrompt exige ref de DOM do gerenciarGarantia.
// No js/main.js eu criei no fix_prazo uma forma de modal. Vamos usar window.prompt para evitar problemas ou criar um helper _promptGeneric no root.

const helperRegex = /function _printReportSolicitation\(\) \{/;
const helperPrompt = `function _promptGeneric(title, label, callback, type = "text") {
    const modal = document.getElementById('modal-generic-edit');
    if (!modal) {
        const ans = window.prompt(label);
        if (ans !== null) callback(ans);
        return;
    }
    const titleEl = document.getElementById('modal-generic-edit-title');
    const labelEl = document.getElementById('modal-generic-edit-label');
    const inputEl = document.getElementById('modal-generic-edit-input');
    const selectEl = document.getElementById('modal-generic-edit-select');
    const btnCancel = document.getElementById('btn-cancel-generic-edit');
    const btnSave = document.getElementById('btn-save-generic-edit');
    const btnClose = document.getElementById('btn-close-generic-edit');

    titleEl.innerText = title;
    labelEl.innerText = label;

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
    newInput.type = type;
    newInput.value = '';

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    const handleSave = () => {
        const val = newInput.value;
        closeModal();
        callback(val);
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
}

function _printReportSolicitation() {`;

js = js.replace(helperRegex, helperPrompt);


fs.writeFileSync('js/main.js', js);
console.log('Main atualizado para incluir o dropdown de STATUS da Fabrica e envio pra linha!');
