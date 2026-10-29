import { API_URLS } from './apiConfig.js';

/**
 * nfeMobile.js
 * Módulo completo de revisão, edição de pedidos e emissão de NF-e / NF-s para o App Mobile.
 */

const FORMAS_PAGAMENTO = [
    { id: '6220056', nome: 'Dinheiro' },
    { id: '6220057', nome: 'Conta a receber/pagar' }
];
const FORMA_PAGAMENTO_PADRAO = '6220057';

let _state = {
    allProducts: [],
    allPedidos: [],
    allNfeData: [],
    currentOrderId: null,
    currentOrder: null,
    currentPedidoBlingBruto: null,
    currentContatoBruto: null,
    currentUf: '',
    transportadorasList: [],
    transportadorasLoaded: false,
    activeMode: 'nfe',
    onOrderUpdated: null,
    showLoading: null,
    hideLoading: null
};

// --- Funções Utilitárias de Formatação e Conversão ---

export function parseCurrency(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    const clean = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
}

export function formatCurrencyValue(val) {
    const num = typeof val === 'number' ? val : parseCurrency(val);
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(num);
}

function _formatCurrencyInput(inputEl, onInputCallback) {
    if (!inputEl) return;

    function formatVal(v) {
        let clean = String(v).replace(/\D/g, '');
        if (!clean || clean === '0' || clean === '00') return 'R$ 0,00';
        let cents = parseInt(clean, 10);
        let valFloat = cents / 100;
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valFloat);
    }

    if (inputEl.value && !inputEl.value.includes('R$')) {
        const num = parseFloat(String(inputEl.value).replace(',', '.')) || 0;
        inputEl.value = formatCurrencyValue(num);
    }

    inputEl.addEventListener('input', (e) => {
        e.target.value = formatVal(e.target.value);
        if (typeof onInputCallback === 'function') onInputCallback();
    });
}

function _getVendedorName(vendedor) {
    if (!vendedor) return '-';
    const v = String(vendedor).trim();
    if (v.includes('ID:')) {
        const id = v.replace('ID:', '').trim();
        if (id === '15596443455') return 'Reginaldo Araujo de Souza';
        if (id === '15596443462') return 'Julio Martins dos Santos';
        if (id === '15596442848') return 'Rodrigo Carbone';
    }
    return vendedor;
}

function _buildFormasPagamentoOptions(selectedId) {
    const effId = String(selectedId || FORMA_PAGAMENTO_PADRAO);
    return FORMAS_PAGAMENTO.map(f => {
        const sel = f.id === effId ? ' selected' : '';
        return `<option value="${f.id}"${sel}>${f.nome}</option>`;
    }).join('');
}

function _addDaysToDate(baseDateStr, days) {
    const date = new Date(baseDateStr + 'T12:00:00');
    date.setDate(date.getDate() + days);
    return date.toISOString().substring(0, 10);
}

// --- Carregamento de Notas Fiscais e Busca de DANFE ---

export async function fetchNfeListData() {
    try {
        const res = await fetch(`${API_URLS.NFE}?t=${Date.now()}`, { mode: 'cors' });
        if (res.ok) {
            const json = await res.json();
            _state.allNfeData = json.data || [];
            return _state.allNfeData;
        }
    } catch (e) {
        console.warn('[nfeMobile] Erro ao carregar lista de NF-e:', e.message);
    }
    return [];
}

export function getDanfeLinkForOrder(order) {
    if (!order) return null;
    const idNota = String(order.id_nota_fiscal || order.id_nota || order['id nota'] || order.idnotafiscal || '').trim();
    if (!idNota || idNota === '0') return null;

    if (_state.allNfeData && _state.allNfeData.length > 0) {
        const found = _state.allNfeData.find(n => {
            const nId = String(n.id_nota || n.id || '').trim();
            const nPedId = String(n.id_pedido || n.idPedido || '').trim();
            const nPedNum = String(n.numero_pedido || n.numeroPedido || '').trim();
            return (nId && nId === idNota) ||
                   (order.id && nPedId && nPedId === String(order.id)) ||
                   (order.numero && nPedNum && nPedNum === String(order.numero));
        });

        if (found) {
            const link = found.link_danfe || found['Link DANFE'] || found.linkDanfe || found.link;
            if (link && link !== '#') return link;
        }
    }

    return `https://www.bling.com.br/notas.fiscais.php#edit/${idNota}`;
}

// --- Inicialização do Módulo ---

export function updateNfeMobileContext({ allProducts, allPedidos }) {
    if (allProducts && allProducts.length > 0) _state.allProducts = allProducts;
    if (allPedidos && allPedidos.length > 0) _state.allPedidos = allPedidos;
}

export function initMobileNfe({ allProducts, allPedidos, onOrderUpdated, showLoading, hideLoading }) {
    _state.allProducts = allProducts || [];
    _state.allPedidos = allPedidos || [];
    _state.onOrderUpdated = onOrderUpdated;
    _state.showLoading = showLoading;
    _state.hideLoading = hideLoading;

    // Carregar lista de NF-e em segundo plano
    fetchNfeListData();

    _bindEvents();
}

function _bindEvents() {
    // Fechar Modal
    const closeBtn = document.getElementById('mobile-nfe-close-btn');
    const cancelBtn = document.getElementById('mobile-nfe-cancel-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeMobileNfeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeMobileNfeModal);

    // Modos NF-e / NF-s
    const modeNfeBtn = document.getElementById('mobile-nfe-mode-nfe-btn');
    const modeNfsBtn = document.getElementById('mobile-nfe-mode-nfs-btn');
    if (modeNfeBtn) modeNfeBtn.addEventListener('click', () => _switchMode('nfe'));
    if (modeNfsBtn) modeNfsBtn.addEventListener('click', () => _switchMode('nfs'));

    // Acordeão de Detalhes Fiscais do Cliente
    const clientToggleBtn = document.getElementById('mobile-nfe-client-toggle-btn');
    if (clientToggleBtn) {
        clientToggleBtn.addEventListener('click', () => {
            const details = document.getElementById('mobile-nfe-client-details');
            const chevron = document.getElementById('mobile-nfe-client-chevron');
            if (details) {
                const isHidden = details.classList.contains('hidden');
                if (isHidden) {
                    details.classList.remove('hidden');
                    if (chevron) chevron.classList.add('rotate-180');
                } else {
                    details.classList.add('hidden');
                    if (chevron) chevron.classList.remove('rotate-180');
                }
            }
        });
    }

    // Consulta de CNPJ
    const consultarCnpjBtn = document.getElementById('mobile-nfe-consultar-cnpj-btn');
    if (consultarCnpjBtn) {
        consultarCnpjBtn.addEventListener('click', _handleConsultarCnpj);
    }

    // Monitoramento da Inscrição Estadual para o badge de aviso
    const ieInput = document.getElementById('mobile-nfe-contato-ie');
    const tipoSelect = document.getElementById('mobile-nfe-contato-tipo');
    if (ieInput) ieInput.addEventListener('input', _updateIeWarning);
    if (tipoSelect) tipoSelect.addEventListener('change', _updateIeWarning);

    // Botão Adicionar Item
    const addItemBtn = document.getElementById('mobile-nfe-add-item-btn');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
            _addNfeItemCard({});
            _calculateTotals();
        });
    }

    // Frete, Desconto e Outras Despesas
    const freteInput = document.getElementById('mobile-nfe-frete');
    const descontoInput = document.getElementById('mobile-nfe-desconto');
    const outrasDespesasInput = document.getElementById('mobile-nfe-outras-despesas');

    _formatCurrencyInput(freteInput, _calculateTotals);
    _formatCurrencyInput(descontoInput, _calculateTotals);
    _formatCurrencyInput(outrasDespesasInput, _calculateTotals);

    // Parcelas
    const addParcelaBtn = document.getElementById('mobile-nfe-add-parcela-btn');
    if (addParcelaBtn) {
        addParcelaBtn.addEventListener('click', () => _addParcelaCard({}));
    }

    const manualParcelasBtn = document.getElementById('mobile-nfe-manual-parcelas-btn');
    if (manualParcelasBtn) {
        manualParcelasBtn.addEventListener('click', _handleManualParcelas);
    }

    // Ações do Rodapé
    const saveBtn = document.getElementById('mobile-nfe-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => _saveOrderEdit(false, false));
    }

    const emitBtn = document.getElementById('mobile-nfe-emit-btn');
    if (emitBtn) {
        emitBtn.addEventListener('click', _handleEmitNfe);
    }

    // Overlay de Console
    const consoleOkBtn = document.getElementById('mobile-nfe-console-ok-btn');
    if (consoleOkBtn) {
        consoleOkBtn.addEventListener('click', () => {
            const overlay = document.getElementById('mobile-nfe-console-overlay');
            if (overlay) overlay.classList.add('hidden');
            closeMobileNfeModal();
            if (_state.onOrderUpdated && _state.currentOrderId) {
                _state.onOrderUpdated(_state.currentOrderId);
            }
        });
    }
}

function _switchMode(mode) {
    _state.activeMode = mode;
    const viewNfe = document.getElementById('mobile-nfe-view-nfe');
    const viewNfs = document.getElementById('mobile-nfe-view-nfs');
    const btnNfe = document.getElementById('mobile-nfe-mode-nfe-btn');
    const btnNfs = document.getElementById('mobile-nfe-mode-nfs-btn');

    if (mode === 'nfs') {
        if (viewNfe) viewNfe.classList.add('hidden');
        if (viewNfs) viewNfs.classList.remove('hidden');
        if (btnNfe) {
            btnNfe.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
            btnNfe.classList.add('text-gray-600');
        }
        if (btnNfs) {
            btnNfs.classList.add('bg-purple-600', 'text-white', 'shadow-sm');
            btnNfs.classList.remove('text-gray-600');
        }
    } else {
        if (viewNfe) viewNfe.classList.remove('hidden');
        if (viewNfs) viewNfs.classList.add('hidden');
        if (btnNfe) {
            btnNfe.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
            btnNfe.classList.remove('text-gray-600');
        }
        if (btnNfs) {
            btnNfs.classList.remove('bg-purple-600', 'text-white', 'shadow-sm');
            btnNfs.classList.add('text-gray-600');
        }
    }
}

// --- Abertura e Preenchimento do Modal ---

export async function openMobileNfeModal(orderId) {
    const modal = document.getElementById('mobile-nfe-modal');
    if (!modal) return;

    // Encontra o pedido no cache local
    const order = _state.allPedidos.find(p => String(p.id) === String(orderId) || String(p.numero) === String(orderId));
    if (!order) {
        alert('Pedido não encontrado.');
        return;
    }

    const internalId = order.id || order.id_pedido || orderId;
    _state.currentOrderId = internalId;
    _state.currentOrder = order;

    if (_state.showLoading) _state.showLoading('Carregando dados completos do pedido...');

    try {
        // Garantir que o catálogo de produtos com pesos e métricas esteja carregado
        const loadProductsPromise = (!_state.allProducts || _state.allProducts.length === 0)
            ? fetch(`${API_URLS.PRODUCTS}?t=${Date.now()}`)
                .then(r => r.json())
                .then(d => { if (d.data) _state.allProducts = d.data; })
                .catch(e => console.warn('[nfeMobile] Erro ao carregar produtos:', e))
            : Promise.resolve();

        const [res] = await Promise.all([
            fetch(`${API_URLS.ORDERS_BLING}/vendas/${internalId}`),
            loadProductsPromise
        ]);

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.message || `Erro ${res.status} ao buscar pedido no Bling`);
        }

        const dataRes = await res.json();
        const pedidoBling = dataRes.data;
        if (!pedidoBling) throw new Error('Dados do pedido não retornados pelo Bling.');

        _state.currentPedidoBlingBruto = JSON.parse(JSON.stringify(pedidoBling));
        _state.currentUf = pedidoBling.transporte?.etiqueta?.uf || pedidoBling.contato?.endereco?.geral?.uf || '';

        // Título e Subtítulo
        const titleEl = document.getElementById('mobile-nfe-title');
        const subTitleEl = document.getElementById('mobile-nfe-subtitle');
        if (titleEl) titleEl.textContent = `Pedido #${pedidoBling.numero || order.numero}`;
        if (subTitleEl) subTitleEl.textContent = `Cliente: ${pedidoBling.contato?.nome || order.contato_nome || '-'}`;

        // 1. Dados Gerais
        const contatoNomeInput = document.getElementById('mobile-nfe-contato-nome');
        if (contatoNomeInput) contatoNomeInput.value = pedidoBling.contato?.nome || '';

        const naturezaSelect = document.getElementById('mobile-nfe-natureza-id');
        if (naturezaSelect) {
            let naturezaId = pedidoBling.naturezaOperacao?.id;
            if (!naturezaId && pedidoBling.itens) {
                const itemComNat = pedidoBling.itens.find(i => i.naturezaOperacao?.id);
                if (itemComNat) naturezaId = itemComNat.naturezaOperacao.id;
            }
            const targetNat = String(naturezaId || '15107272436').trim();
            // Opção customizada se não for padrão
            let customOpt = naturezaSelect.querySelector('option[data-custom="true"]');
            if (customOpt) customOpt.remove();
            if (targetNat && targetNat !== '15107272436' && targetNat !== '15107272437' && targetNat !== '15108636006') {
                const opt = document.createElement('option');
                opt.value = targetNat;
                opt.textContent = `Outra (${targetNat})`;
                opt.setAttribute('data-custom', 'true');
                naturezaSelect.appendChild(opt);
            }
            naturezaSelect.value = targetNat;
        }

        const todayStr = new Date().toISOString().substring(0, 10);
        const dataInput = document.getElementById('mobile-nfe-data');
        const dataSaidaInput = document.getElementById('mobile-nfe-data-saida');
        const dataPrevistaInput = document.getElementById('mobile-nfe-data-prevista');

        if (dataInput) dataInput.value = pedidoBling.data || todayStr;
        if (dataSaidaInput) dataSaidaInput.value = pedidoBling.dataSaida || todayStr;
        if (dataPrevistaInput) dataPrevistaInput.value = pedidoBling.dataPrevista || todayStr;

        // 2. Detalhes Fiscais do Cliente
        const contatoIdInput = document.getElementById('mobile-nfe-contato-id');
        const fantasiaInput = document.getElementById('mobile-nfe-contato-fantasia');
        const tipoInput = document.getElementById('mobile-nfe-contato-tipo');
        const cnpjInput = document.getElementById('mobile-nfe-contato-cnpj');
        const ieInput = document.getElementById('mobile-nfe-contato-ie');
        const contribuinteInput = document.getElementById('mobile-nfe-contato-contribuinte');

        if (contatoIdInput) contatoIdInput.value = pedidoBling.contato?.id || '';
        if (fantasiaInput) fantasiaInput.value = '';
        const initialDoc = (pedidoBling.contato?.numeroDocumento || '').replace(/\D/g, '');
        const initialTipo = pedidoBling.contato?.tipoPessoa || (initialDoc.length === 11 ? 'F' : 'J');
        if (tipoInput) tipoInput.value = initialTipo;
        if (cnpjInput) cnpjInput.value = pedidoBling.contato?.numeroDocumento || '';
        if (ieInput) ieInput.value = pedidoBling.contato?.ie || '';
        if (contribuinteInput) contribuinteInput.value = pedidoBling.contato?.indicadorIe || '9';

        // Esconder acordeão por padrão
        const detailsEl = document.getElementById('mobile-nfe-client-details');
        const chevronEl = document.getElementById('mobile-nfe-client-chevron');
        if (detailsEl) detailsEl.classList.add('hidden');
        if (chevronEl) chevronEl.classList.remove('rotate-180');

        _updateIeWarning();

        // Buscar dados completos do cliente em segundo plano
        if (pedidoBling.contato?.id) {
            fetch(`${API_URLS.ORDERS_BLING}/contatos/${pedidoBling.contato.id}`)
                .then(r => r.json())
                .then(cRes => {
                    const c = cRes.data;
                    if (c && String(c.id) === String(pedidoBling.contato.id)) {
                        _state.currentContatoBruto = JSON.parse(JSON.stringify(c));
                        if (fantasiaInput) fantasiaInput.value = c.fantasia || '';
                        const docClean = (c.numeroDocumento || '').replace(/\D/g, '');
                        const tipoCalc = c.tipoPessoa || (docClean.length === 11 ? 'F' : 'J');
                        if (tipoInput) tipoInput.value = tipoCalc;
                        if (cnpjInput && !cnpjInput.value) cnpjInput.value = c.numeroDocumento || '';
                        if (ieInput && !ieInput.value) ieInput.value = c.ie || '';
                        if (contribuinteInput && c.indicadorIe !== undefined) contribuinteInput.value = c.indicadorIe;
                        _state.currentUf = c.endereco?.geral?.uf || _state.currentUf;
                        _updateIeWarning();
                    }
                })
                .catch(err => console.warn('[nfeMobile] Falha ao carregar contato detalhado:', err));
        }

        // 3. Transporte & Volumes
        const fretePorContaSelect = document.getElementById('mobile-nfe-frete-por-conta');
        if (fretePorContaSelect) {
            const freteContaVal = pedidoBling.transporte?.fretePorConta !== undefined ? parseInt(pedidoBling.transporte.fretePorConta) : 9;
            fretePorContaSelect.value = freteContaVal;
        }

        const volumesInput = document.getElementById('mobile-nfe-volumes');
        const pesoBrutoInput = document.getElementById('mobile-nfe-peso-bruto');
        const pesoLiquidoInput = document.getElementById('mobile-nfe-peso-liquido');

        if (volumesInput) volumesInput.value = pedidoBling.transporte?.quantidadeVolumes || 0;
        if (pesoBrutoInput) pesoBrutoInput.value = pedidoBling.transporte?.pesoBruto || 0;
        if (pesoLiquidoInput) pesoLiquidoInput.value = pedidoBling.transporte?.pesoLiquido || pedidoBling.transporte?.pesoBruto || 0;

        // Carregar transportadoras do Bling
        await _loadTransportadoras(pedidoBling.transporte?.contato?.id, pedidoBling.transporte?.contato?.nome);

        // 4. Valores: Frete, Desconto, Outras Despesas
        const freteInput = document.getElementById('mobile-nfe-frete');
        const descontoInput = document.getElementById('mobile-nfe-desconto');
        const outrasDespesasInput = document.getElementById('mobile-nfe-outras-despesas');

        if (freteInput) freteInput.value = formatCurrencyValue(pedidoBling.transporte?.frete || 0);
        if (descontoInput) descontoInput.value = formatCurrencyValue(pedidoBling.desconto?.valor || 0);
        if (outrasDespesasInput) outrasDespesasInput.value = formatCurrencyValue(pedidoBling.outrasDespesas || 0);

        // 5. Itens da Nota
        const itensContainer = document.getElementById('mobile-nfe-itens-container');
        if (itensContainer) {
            itensContainer.innerHTML = '';
            if (pedidoBling.itens && Array.isArray(pedidoBling.itens)) {
                pedidoBling.itens.forEach(item => _addNfeItemCard(item));
            }
        }

        // 6. Parcelas
        const parcelasContainer = document.getElementById('mobile-nfe-parcelas-container');
        if (parcelasContainer) {
            parcelasContainer.innerHTML = '';
            if (pedidoBling.parcelas && Array.isArray(pedidoBling.parcelas) && pedidoBling.parcelas.length > 0) {
                pedidoBling.parcelas.forEach(p => _addParcelaCard(p));
            }
        }

        // 7. Observações da Nota (Original e Fiscal)
        const obsOriginalEl = document.getElementById('mobile-nfe-observacoes-original');
        const obsEl = document.getElementById('mobile-nfe-observacoes');

        if (obsOriginalEl) obsOriginalEl.value = pedidoBling.observacoes || '';

        let obsFiscal = pedidoBling.observacoes || '';
        const orcamentoVal = order.orcamento || order['orcamento'] || '';
        let vendedorVal = pedidoBling.vendedor;
        if (typeof vendedorVal === 'object' && vendedorVal?.id) vendedorVal = vendedorVal.id;
        const vendedorNome = _getVendedorName(vendedorVal || order.vendedor);

        let appendInfo = '';
        if (orcamentoVal && String(orcamentoVal).trim() !== '-' && String(orcamentoVal).trim() !== '0') {
            appendInfo += `Orçamento: ${String(orcamentoVal).trim()}\n`;
        }
        if (vendedorNome && vendedorNome !== '-') {
            appendInfo += `Vendedor: ${vendedorNome}`;
        }
        appendInfo = appendInfo.trim();

        if (appendInfo && !obsFiscal.includes(appendInfo)) {
            obsFiscal = obsFiscal ? `${obsFiscal.trim()}\n\n${appendInfo}` : appendInfo;
        }
        if (obsEl) obsEl.value = obsFiscal;

        // 8. Serviços e Visualização NF-s
        const serviceItems = (pedidoBling.itens || []).filter(item => {
            const cod = String(item.codigo || item.sku || '').trim();
            return cod.startsWith('7');
        });
        const hasService = serviceItems.length > 0;

        const modeNfsBtn = document.getElementById('mobile-nfe-mode-nfs-btn');
        const modeNfsBadge = document.getElementById('mobile-nfe-mode-nfs-badge');

        if (modeNfsBtn) {
            if (hasService) {
                modeNfsBtn.disabled = false;
                modeNfsBtn.classList.remove('opacity-40');
                if (modeNfsBadge) {
                    modeNfsBadge.textContent = `${serviceItems.length}`;
                    modeNfsBadge.classList.remove('hidden');
                }
            } else {
                modeNfsBtn.disabled = true;
                modeNfsBtn.classList.add('opacity-40');
                if (modeNfsBadge) modeNfsBadge.classList.add('hidden');
            }
        }

        _populateNfsView(serviceItems);
        _switchMode('nfe');

        // 9. Cálculo Final dos Totais
        _calculateTotals();

        // Abre o modal
        modal.classList.remove('hidden');

    } catch (err) {
        console.error('[nfeMobile] Erro ao abrir modal de NF-e:', err);
        alert('Erro ao carregar dados do pedido: ' + err.message);
    } finally {
        if (_state.hideLoading) _state.hideLoading();
    }
}

export function closeMobileNfeModal() {
    const modal = document.getElementById('mobile-nfe-modal');
    if (modal) modal.classList.add('hidden');
}

// --- Transportadoras do Bling ---

async function _loadTransportadoras(selectedId, selectedNome) {
    const select = document.getElementById('mobile-nfe-transportadora');
    if (!select) return;

    function applyValue(id, nome) {
        if (id && Array.from(select.options).some(o => o.value === String(id))) {
            select.value = String(id);
        } else if (nome) {
            const opt = Array.from(select.options).find(o => o.text.toUpperCase() === String(nome).toUpperCase());
            select.value = opt ? opt.value : '';
        } else {
            select.value = '';
        }
    }

    if (_state.transportadorasLoaded && _state.transportadorasList.length > 0) {
        applyValue(selectedId, selectedNome);
        return;
    }

    try {
        select.innerHTML = '<option value="">Carregando transportadoras...</option>';
        const res = await fetch(`${API_URLS.ORDERS_BLING}/contatos?idTipoContato=14578222406`);
        if (res.ok) {
            const result = await res.json();
            _state.transportadorasList = result.data || [];
            _state.transportadorasLoaded = true;

            let html = '<option value="">Selecione a Transportadora</option>';
            _state.transportadorasList.forEach(t => {
                html += `<option value="${t.id}">${t.nome}</option>`;
            });
            select.innerHTML = html;
            applyValue(selectedId, selectedNome);
        } else {
            select.innerHTML = '<option value="">Não foi possível carregar</option>';
        }
    } catch (e) {
        console.warn('[nfeMobile] Erro ao buscar transportadoras:', e);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// --- Renderização de Itens (Cards Mobile) ---

function _addNfeItemCard(item = {}) {
    const container = document.getElementById('mobile-nfe-itens-container');
    if (!container) return;

    let itemPeso = (item.pesoBruto !== undefined && item.pesoBruto !== null) ? parseFloat(item.pesoBruto) : 
                   ((item.peso !== undefined && item.peso !== null) ? parseFloat(item.peso) : null);

    let matchedProduct = null;
    if (_state.allProducts && _state.allProducts.length > 0) {
        matchedProduct = _state.allProducts.find(p => 
            String(p.id) === String(item.produto?.id || item.id) || 
            String(p.codigo || '').trim().toLowerCase() === String(item.codigo || '').trim().toLowerCase()
        );
    }

    if ((!itemPeso || itemPeso === 0) && matchedProduct) {
        itemPeso = parseFloat(matchedProduct.pesoBruto) || 
                   parseFloat(matchedProduct.pesoLiquido) || 
                   parseFloat(matchedProduct.metricas?.peso_bruto) || 
                   parseFloat(matchedProduct.metricas?.peso_liquido) || 
                   parseFloat(matchedProduct.peso_bruto) || 
                   parseFloat(matchedProduct.peso_liquido) || 0;
    }
    if (!itemPeso) itemPeso = 0;

    const card = document.createElement('div');
    card.className = 'mobile-nfe-item-card bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2 relative';
    if (item.id) card.dataset.itemId = item.id;

    const initialValor = item.valor !== undefined ? item.valor : 0;
    const initialQtd = item.quantidade !== undefined ? item.quantidade : 1;
    const isService = String(item.codigo || '').startsWith('7');

    card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 flex-grow">
                <span class="text-[10px] font-bold ${isService ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 rounded-md">
                    ${isService ? 'SERVIÇO' : 'PEÇA'}
                </span>
                <input type="text" class="mobile-item-codigo text-xs font-mono font-bold bg-white border border-gray-300 rounded px-2 py-1 w-28 uppercase" 
                       placeholder="Código" value="${item.codigo || ''}">
            </div>
            <button type="button" class="mobile-item-remove-btn text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Remover item">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
        </div>

        <div>
            <input type="text" class="mobile-item-descricao text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 w-full font-medium" 
                   placeholder="Descrição do produto / serviço" value="${item.descricao || ''}">
        </div>

        <div class="grid grid-cols-3 gap-2 pt-1 border-t border-gray-200">
            <div>
                <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Qtd</label>
                <input type="number" min="1" step="1" class="mobile-item-quantidade text-xs text-center bg-white border border-gray-300 rounded-lg px-2 py-1.5 w-full font-bold" 
                       value="${initialQtd}">
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Preço Unit.</label>
                <input type="text" class="mobile-item-valor text-xs text-right bg-white border border-gray-300 rounded-lg px-2 py-1.5 w-full font-bold" 
                       value="${formatCurrencyValue(initialValor)}">
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 font-semibold mb-0.5 text-right">Subtotal</label>
                <div class="mobile-item-subtotal text-xs text-right font-extrabold text-gray-800 py-1.5">
                    ${formatCurrencyValue(initialQtd * initialValor)}
                </div>
            </div>
        </div>

        <div class="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
            <span class="font-medium">Peso Unitário:</span>
            <div class="flex items-center gap-1.5">
                <input type="number" step="0.001" min="0" class="mobile-item-peso w-20 text-center bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs font-bold text-gray-800" 
                       value="${itemPeso}">
                <span class="text-xs text-gray-600 font-medium">kg</span>
                <button type="button" class="mobile-item-sync-peso-btn hidden p-1 text-blue-600 hover:text-blue-800 bg-white border border-blue-200 rounded shadow-sm transition-all" 
                        title="Salvar novo peso no Bling" data-original-peso="${itemPeso}">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                </button>
            </div>
        </div>
    `;

    // Listeners do Card
    const removeBtn = card.querySelector('.mobile-item-remove-btn');
    removeBtn.addEventListener('click', () => {
        card.remove();
        _calculateTotals();
    });

    const qtdInput = card.querySelector('.mobile-item-quantidade');
    const valorInput = card.querySelector('.mobile-item-valor');
    const codigoInput = card.querySelector('.mobile-item-codigo');
    const pesoInput = card.querySelector('.mobile-item-peso');
    const syncPesoBtn = card.querySelector('.mobile-item-sync-peso-btn');

    _formatCurrencyInput(valorInput, _calculateTotals);
    if (qtdInput) qtdInput.addEventListener('input', _calculateTotals);

    if (pesoInput) {
        pesoInput.addEventListener('input', () => {
            _calculateTotals();
            if (syncPesoBtn) {
                const orig = parseFloat(syncPesoBtn.dataset.originalPeso) || 0;
                const curr = parseFloat(pesoInput.value) || 0;
                if (curr !== orig) {
                    syncPesoBtn.classList.remove('hidden');
                } else {
                    syncPesoBtn.classList.add('hidden');
                }
            }
        });
    }

    if (syncPesoBtn) {
        syncPesoBtn.addEventListener('click', async () => {
            const currentPeso = parseFloat(pesoInput.value) || 0;
            const originalHtml = syncPesoBtn.innerHTML;
            syncPesoBtn.disabled = true;
            syncPesoBtn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-blue-600" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

            try {
                let prodId = matchedProduct?.id;
                if (!prodId && _state.allProducts) {
                    const p = _state.allProducts.find(x => String(x.codigo).trim().toLowerCase() === String(codigoInput?.value || '').trim().toLowerCase());
                    if (p) prodId = p.id;
                }

                if (prodId) {
                    await fetch(`${API_URLS.PRODUCTS}/${prodId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ peso_bruto: currentPeso, peso_liquido: currentPeso })
                    });
                    if (matchedProduct) {
                        if (!matchedProduct.metricas) matchedProduct.metricas = {};
                        matchedProduct.metricas.peso_bruto = currentPeso;
                        matchedProduct.metricas.peso_liquido = currentPeso;
                        matchedProduct.pesoBruto = currentPeso;
                    }
                    syncPesoBtn.dataset.originalPeso = currentPeso;
                    syncPesoBtn.innerHTML = `<svg class="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
                    setTimeout(() => {
                        syncPesoBtn.classList.add('hidden');
                        syncPesoBtn.innerHTML = originalHtml;
                        syncPesoBtn.disabled = false;
                    }, 2000);
                } else {
                    alert('Produto não localizado no catálogo para salvar o peso.');
                    syncPesoBtn.innerHTML = originalHtml;
                    syncPesoBtn.disabled = false;
                }
            } catch (e) {
                alert('Erro ao sincronizar peso: ' + e.message);
                syncPesoBtn.innerHTML = originalHtml;
                syncPesoBtn.disabled = false;
            }
        });
    }

    if (codigoInput) {
        codigoInput.addEventListener('input', _calculateTotals);
        codigoInput.addEventListener('change', () => {
            const codVal = codigoInput.value.trim().toLowerCase();
            const prod = _state.allProducts.find(p => String(p.codigo || '').trim().toLowerCase() === codVal);
            if (prod) {
                const descInput = card.querySelector('.mobile-item-descricao');
                if (descInput && (!descInput.value || descInput.value.trim() === '')) {
                    descInput.value = prod.descricao || '';
                }
                const pVal = parseFloat(prod.pesoBruto) || parseFloat(prod.pesoLiquido) || parseFloat(prod.metricas?.peso_bruto) || parseFloat(prod.metricas?.peso_liquido) || 0;
                if (pVal > 0 && pesoInput) {
                    pesoInput.value = pVal;
                    if (syncPesoBtn) syncPesoBtn.dataset.originalPeso = pVal;
                }
            }
            _calculateTotals();
        });
    }

    container.appendChild(card);
}

// --- Renderização de Parcelas (Cards Mobile) ---

function _addParcelaCard(parcela = {}) {
    const container = document.getElementById('mobile-nfe-parcelas-container');
    if (!container) return;

    let dataVenc = '';
    if (parcela.dataVencimento) {
        dataVenc = parcela.dataVencimento.substring(0, 10);
    } else {
        const dateInput = document.getElementById('mobile-nfe-data');
        dataVenc = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().substring(0, 10);
    }

    const card = document.createElement('div');
    card.className = 'mobile-nfe-parcela-card bg-gray-50 p-2.5 rounded-xl border border-gray-200 space-y-2 relative';

    const initialValor = parcela.valor !== undefined ? parcela.valor : 0;
    const initialFormaId = parcela.formaPagamento?.id || FORMA_PAGAMENTO_PADRAO;

    card.innerHTML = `
        <div class="flex items-center gap-2">
            <div class="flex-grow">
                <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Vencimento</label>
                <input type="date" class="mobile-parcela-data text-xs bg-white border border-gray-300 rounded-lg px-2 py-1.5 w-full font-medium" 
                       value="${dataVenc}">
            </div>
            <div class="w-32">
                <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Valor (R$)</label>
                <input type="text" class="mobile-parcela-valor text-xs text-right bg-white border border-gray-300 rounded-lg px-2 py-1.5 w-full font-bold" 
                       value="${formatCurrencyValue(initialValor)}">
            </div>
            <button type="button" class="mobile-parcela-remove-btn text-red-500 hover:text-red-700 p-1.5 mt-4 rounded-lg hover:bg-red-50 transition-colors" title="Excluir parcela">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
            <div>
                <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Forma de Pagto</label>
                <select class="mobile-parcela-forma text-xs bg-white border border-gray-300 rounded-lg px-2 py-1.5 w-full">
                    ${_buildFormasPagamentoOptions(initialFormaId)}
                </select>
            </div>
            <div>
                <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Observação</label>
                <input type="text" class="mobile-parcela-obs text-xs bg-white border border-gray-300 rounded-lg px-2 py-1.5 w-full" 
                       placeholder="Opcional" value="${parcela.observacoes || ''}">
            </div>
        </div>
    `;

    const removeBtn = card.querySelector('.mobile-parcela-remove-btn');
    removeBtn.addEventListener('click', () => card.remove());

    const valorInput = card.querySelector('.mobile-parcela-valor');
    _formatCurrencyInput(valorInput);

    container.appendChild(card);
}

// --- Geração Rápida de Parcelas (ex: 28,35,70 ou 0) ---

function _handleManualParcelas() {
    const input = document.getElementById('mobile-nfe-manual-parcelas-input');
    if (!input) return;

    const raw = input.value.trim();
    if (!raw) {
        alert('Informe os dias separados por vírgula (ex: 28,35,70 ou 0 para à vista).');
        return;
    }

    const parts = raw.split(/[^0-9]+/);
    const days = parts.map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p) && p >= 0);

    if (days.length === 0) {
        alert('Nenhum número de dias válido detectado.');
        return;
    }

    _generateParcelasWithDays(days);
}

function _generateParcelasWithDays(days) {
    const container = document.getElementById('mobile-nfe-parcelas-container');
    if (!container) return;

    // Calcula total atual da nota
    let totalItens = 0;
    const cards = document.querySelectorAll('.mobile-nfe-item-card');
    cards.forEach(c => {
        const qtd = parseFloat(c.querySelector('.mobile-item-quantidade')?.value) || 0;
        const val = parseCurrency(c.querySelector('.mobile-item-valor')?.value);
        totalItens += qtd * val;
    });

    const frete = parseCurrency(document.getElementById('mobile-nfe-frete')?.value);
    const desconto = parseCurrency(document.getElementById('mobile-nfe-desconto')?.value);
    const outras = parseCurrency(document.getElementById('mobile-nfe-outras-despesas')?.value);

    let totalIPI = 0;
    if (_state.currentPedidoBlingBruto?.tributacao?.totalIPI) {
        totalIPI = parseFloat(_state.currentPedidoBlingBruto.tributacao.totalIPI) || 0;
    }

    const totalNota = Math.round((totalItens + frete + outras + totalIPI - desconto) * 100) / 100;

    if (totalNota <= 0) {
        alert('O valor total líquido calculado para a nota é R$ 0,00 ou menor. Adicione itens com valores antes de ajustar as parcelas.');
        return;
    }

    let formaPagamentoId = FORMA_PAGAMENTO_PADRAO;
    const firstFormaSelect = container.querySelector('.mobile-parcela-forma');
    if (firstFormaSelect) formaPagamentoId = firstFormaSelect.value;

    const numParcelas = days.length;
    const baseValor = Math.floor((totalNota / numParcelas) * 100) / 100;
    let somaCalculada = 0;
    const baseDateStr = new Date().toISOString().substring(0, 10);

    container.innerHTML = '';

    for (let i = 0; i < numParcelas; i++) {
        let valorP = baseValor;
        if (i === numParcelas - 1) {
            valorP = Math.round((totalNota - somaCalculada) * 100) / 100;
        } else {
            somaCalculada += baseValor;
        }

        const vencimentoStr = _addDaysToDate(baseDateStr, days[i]);
        _addParcelaCard({
            dataVencimento: vencimentoStr,
            valor: valorP,
            formaPagamento: { id: formaPagamentoId },
            observacoes: ''
        });
    }
}

// --- Cálculos de Totais ---

function _calculateTotals() {
    const cards = document.querySelectorAll('.mobile-nfe-item-card');
    let totalPecas = 0;
    let totalServicos = 0;

    cards.forEach(card => {
        const cod = (card.querySelector('.mobile-item-codigo')?.value || '').trim();
        const qtd = parseFloat(card.querySelector('.mobile-item-quantidade')?.value) || 0;
        const val = parseCurrency(card.querySelector('.mobile-item-valor')?.value);
        const subtotal = qtd * val;

        const subtotalEl = card.querySelector('.mobile-item-subtotal');
        if (subtotalEl) subtotalEl.textContent = formatCurrencyValue(subtotal);

        if (cod.startsWith('7')) {
            totalServicos += subtotal;
        } else {
            totalPecas += subtotal;
        }
    });

    const frete = parseCurrency(document.getElementById('mobile-nfe-frete')?.value);
    const desconto = parseCurrency(document.getElementById('mobile-nfe-desconto')?.value);
    const outras = parseCurrency(document.getElementById('mobile-nfe-outras-despesas')?.value);

    let totalIPI = 0;
    if (_state.currentPedidoBlingBruto?.tributacao?.totalIPI) {
        totalIPI = parseFloat(_state.currentPedidoBlingBruto.tributacao.totalIPI) || 0;
    }

    const totalPecasComFrete = totalPecas + frete;
    const totalNota = totalPecasComFrete + totalServicos + outras + totalIPI - desconto;

    // Calcular peso total somado dos itens
    let totalPesoCalculado = 0;
    cards.forEach(card => {
        const qtd = parseFloat(card.querySelector('.mobile-item-quantidade')?.value) || 0;
        const peso = parseFloat(card.querySelector('.mobile-item-peso')?.value) || 0;
        totalPesoCalculado += qtd * peso;
    });
    totalPesoCalculado = Math.round(totalPesoCalculado * 1000) / 1000;

    const pesoBrutoInput = document.getElementById('mobile-nfe-peso-bruto');
    const pesoLiquidoInput = document.getElementById('mobile-nfe-peso-liquido');

    // Se o peso bruto do transporte estiver zerado ou vazio, preenche automaticamente com o total dos itens
    if (pesoBrutoInput && (!parseFloat(pesoBrutoInput.value) || parseFloat(pesoBrutoInput.value) === 0)) {
        if (totalPesoCalculado > 0) pesoBrutoInput.value = totalPesoCalculado;
    }
    if (pesoLiquidoInput && (!parseFloat(pesoLiquidoInput.value) || parseFloat(pesoLiquidoInput.value) === 0)) {
        if (totalPesoCalculado > 0) pesoLiquidoInput.value = totalPesoCalculado;
    }

    const elPecas = document.getElementById('mobile-nfe-total-pecas');
    const elServicos = document.getElementById('mobile-nfe-total-servicos');
    const elPedido = document.getElementById('mobile-nfe-total-pedido');
    const elNfsServicos = document.getElementById('mobile-nfs-total-servicos');

    if (elPecas) elPecas.textContent = formatCurrencyValue(totalPecasComFrete);
    if (elServicos) elServicos.textContent = formatCurrencyValue(totalServicos);
    if (elPedido) elPedido.textContent = formatCurrencyValue(totalNota);
    if (elNfsServicos) elNfsServicos.textContent = formatCurrencyValue(totalServicos);
}

// --- Aba de Serviços (NF-s) ---

function _populateNfsView(serviceItems) {
    const container = document.getElementById('mobile-nfs-itens-container');
    const obsNfs = document.getElementById('mobile-nfs-observacoes');
    if (!container) return;

    container.innerHTML = '';
    if (!serviceItems || serviceItems.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400 py-4 text-center">Nenhum serviço identificado.</p>';
        return;
    }

    serviceItems.forEach(s => {
        const card = document.createElement('div');
        card.className = 'p-2.5 bg-purple-50 rounded-lg border border-purple-100 flex justify-between items-center text-xs';
        card.innerHTML = `
            <div>
                <span class="font-bold font-mono text-purple-900">${s.codigo || ''}</span>
                <p class="text-purple-800 font-medium leading-tight">${s.descricao || ''}</p>
                <span class="text-[10px] text-purple-600">Qtd: ${s.quantidade || 1}</span>
            </div>
            <div class="font-bold text-purple-900 text-right">
                ${formatCurrencyValue((s.quantidade || 1) * (s.valor || 0))}
            </div>
        `;
        container.appendChild(card);
    });

    if (obsNfs && !obsNfs.value) {
        obsNfs.value = 'Serviços prestados referentes a manutenção/revisão conforme orçamento.';
    }
}

// --- Consulta CNPJ e Detalhes Fiscais ---

async function _handleConsultarCnpj() {
    const cnpjInput = document.getElementById('mobile-nfe-contato-cnpj');
    const btn = document.getElementById('mobile-nfe-consultar-cnpj-btn');
    if (!cnpjInput || !btn) return;

    const cnpj = cnpjInput.value.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) {
        alert('Por favor, informe um CNPJ válido com 14 dígitos para consultar.');
        return;
    }

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

    try {
        const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
        if (!res.ok) {
            if (res.status === 429) {
                throw new Error('Limite de consultas excedido na API pública. Aguarde um instante.');
            }
            throw new Error('CNPJ não encontrado ou inválido.');
        }

        const data = await res.json();
        let ieEncontrada = '';

        if (data.estabelecimento?.inscricoes_estaduais && data.estabelecimento.inscricoes_estaduais.length > 0) {
            const targetUf = String(_state.currentUf || '').trim().toUpperCase();
            let ieAtiva = data.estabelecimento.inscricoes_estaduais.find(ie => {
                const ieUf = String(ie.estado?.sigla || '').trim().toUpperCase();
                return ie.ativo === true && ieUf === targetUf && targetUf !== '';
            });
            if (!ieAtiva) {
                ieAtiva = data.estabelecimento.inscricoes_estaduais.find(ie => ie.ativo === true);
            }
            if (ieAtiva && ieAtiva.inscricao_estadual) {
                ieEncontrada = ieAtiva.inscricao_estadual.replace(/\D/g, '');
            }
        }

        const ieEl = document.getElementById('mobile-nfe-contato-ie');
        const contribEl = document.getElementById('mobile-nfe-contato-contribuinte');

        if (ieEl) {
            ieEl.value = ieEncontrada;
            if (contribEl) {
                if (ieEncontrada.toLowerCase() === 'isento') {
                    contribEl.value = '2'; // Isento
                } else if (ieEncontrada !== '') {
                    contribEl.value = '1'; // Contribuinte
                } else {
                    contribEl.value = '9'; // Não contribuinte
                }
            }
        }

        _updateIeWarning();
        alert('CNPJ consultado com sucesso! Dados fiscais atualizados.');

    } catch (err) {
        alert(err.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

function _updateIeWarning() {
    const ieInput = document.getElementById('mobile-nfe-contato-ie');
    const warningBadge = document.getElementById('mobile-nfe-ie-warning');
    const tipoSelect = document.getElementById('mobile-nfe-contato-tipo');

    if (!warningBadge) return;
    const tipo = tipoSelect ? tipoSelect.value : 'J';
    const ieVal = ieInput ? ieInput.value.trim() : '';

    if (tipo === 'F' || ieVal) {
        warningBadge.classList.add('hidden');
    } else {
        warningBadge.classList.remove('hidden');
    }
}

// --- Salvar Edição no Bling (PUT) ---

async function _saveOrderEdit(silent = false, skipConfirm = false) {
    const idPedido = _state.currentOrderId;
    if (!idPedido || !_state.currentPedidoBlingBruto) {
        alert('Erro: Pedido original não carregado.');
        return { success: false, error: 'Pedido não carregado' };
    }

    const payloadUpdate = JSON.parse(JSON.stringify(_state.currentPedidoBlingBruto));

    // Contato
    const contatoIdStr = document.getElementById('mobile-nfe-contato-id')?.value.trim();
    const contatoNome = document.getElementById('mobile-nfe-contato-nome')?.value.trim();
    const contatoFantasia = document.getElementById('mobile-nfe-contato-fantasia')?.value.trim();
    const contatoTipo = document.getElementById('mobile-nfe-contato-tipo')?.value || 'J';
    const contatoCnpj = document.getElementById('mobile-nfe-contato-cnpj')?.value.trim();
    const contatoIe = document.getElementById('mobile-nfe-contato-ie')?.value.trim();
    const contatoContribuinte = parseInt(document.getElementById('mobile-nfe-contato-contribuinte')?.value) || 9;

    const dataOperacao = document.getElementById('mobile-nfe-data')?.value.trim();
    const dataSaida = document.getElementById('mobile-nfe-data-saida')?.value.trim();
    const dataPrevista = document.getElementById('mobile-nfe-data-prevista')?.value.trim();
    const observacoes = document.getElementById('mobile-nfe-observacoes')?.value.trim();

    const transportadoraSelect = document.getElementById('mobile-nfe-transportadora');
    const transportadoraIdStr = transportadoraSelect ? transportadoraSelect.value : '';
    const transportadoraNome = transportadoraSelect && transportadoraSelect.selectedIndex > 0 ? transportadoraSelect.options[transportadoraSelect.selectedIndex].text : '';

    const frete = parseCurrency(document.getElementById('mobile-nfe-frete')?.value);
    const fretePorConta = parseInt(document.getElementById('mobile-nfe-frete-por-conta')?.value) || 0;
    const volumes = parseInt(document.getElementById('mobile-nfe-volumes')?.value) || 0;
    const pesoBruto = parseFloat(document.getElementById('mobile-nfe-peso-bruto')?.value) || 0;
    const pesoLiquido = parseFloat(document.getElementById('mobile-nfe-peso-liquido')?.value) || 0;
    const descontoVal = parseCurrency(document.getElementById('mobile-nfe-desconto')?.value);
    const outrasDespesasVal = parseCurrency(document.getElementById('mobile-nfe-outras-despesas')?.value);

    if (!contatoIdStr) {
        alert('ID do cliente não informado.');
        return { success: false, error: 'Sem ID do cliente' };
    }
    const contatoId = parseInt(contatoIdStr);

    // Itens
    const itemCards = document.querySelectorAll('.mobile-nfe-item-card');
    const items = [];
    for (const card of itemCards) {
        const codigo = card.querySelector('.mobile-item-codigo')?.value.trim() || '';
        const descricao = card.querySelector('.mobile-item-descricao')?.value.trim() || '';
        const quantidade = parseFloat(card.querySelector('.mobile-item-quantidade')?.value) || 0;
        const peso = parseFloat(card.querySelector('.mobile-item-peso')?.value) || 0;
        const valor = parseCurrency(card.querySelector('.mobile-item-valor')?.value);
        const idItem = card.dataset.itemId || null;

        if (!descricao) {
            alert('Todos os itens devem conter uma descrição.');
            return { success: false, error: 'Descrição vazia' };
        }
        if (quantidade <= 0) {
            alert(`O item "${descricao}" deve ter quantidade maior que zero.`);
            return { success: false, error: 'Quantidade inválida' };
        }
        items.push({ codigo, descricao, quantidade, peso, valor, idItem });
    }

    if (items.length === 0) {
        alert('A nota deve possuir pelo menos 1 item.');
        return { success: false, error: 'Sem itens' };
    }

    // Parcelas
    const parcelaCards = document.querySelectorAll('.mobile-nfe-parcela-card');
    const parcelas = [];
    for (const card of parcelaCards) {
        const dataVenc = card.querySelector('.mobile-parcela-data')?.value;
        const valor = parseCurrency(card.querySelector('.mobile-parcela-valor')?.value);
        const formaIdStr = card.querySelector('.mobile-parcela-forma')?.value.trim();
        const obs = card.querySelector('.mobile-parcela-obs')?.value.trim() || '';

        if (!dataVenc) {
            alert('Todas as parcelas devem conter data de vencimento.');
            return { success: false, error: 'Vencimento vazio' };
        }
        if (valor <= 0) {
            alert('Todas as parcelas devem ter valor maior que zero.');
            return { success: false, error: 'Valor parcela zero' };
        }

        const pObj = { dataVencimento: dataVenc, valor, observacoes: obs };
        if (formaIdStr) {
            const formaId = parseInt(formaIdStr);
            if (!isNaN(formaId)) pObj.formaPagamento = { id: formaId };
        }
        parcelas.push(pObj);
    }

    if (!skipConfirm) {
        const ok = confirm('Tem certeza de que deseja atualizar este pedido no Bling com as informações preenchidas?');
        if (!ok) return { success: false, error: 'Cancelado pelo usuário' };
    }

    // Prepara payload de atualização
    payloadUpdate.contato = { id: contatoId };
    if (dataOperacao) payloadUpdate.data = dataOperacao;
    if (dataSaida) payloadUpdate.dataSaida = dataSaida;
    if (dataPrevista) payloadUpdate.dataPrevista = dataPrevista;
    if (observacoes) payloadUpdate.observacoes = observacoes;

    payloadUpdate.itens = items.map((i, index) => {
        let originalItem = null;
        if (i.idItem) {
            originalItem = _state.currentPedidoBlingBruto.itens?.find(orig => String(orig.id) === i.idItem);
        }
        if (!originalItem && _state.currentPedidoBlingBruto.itens && _state.currentPedidoBlingBruto.itens[index]) {
            originalItem = _state.currentPedidoBlingBruto.itens[index];
        }

        if (originalItem) {
            return {
                ...originalItem,
                codigo: i.codigo,
                descricao: i.descricao,
                quantidade: i.quantidade,
                pesoBruto: i.peso,
                pesoLiquido: i.peso,
                valor: i.valor
            };
        } else {
            return {
                codigo: i.codigo,
                descricao: i.descricao,
                quantidade: i.quantidade,
                pesoBruto: i.peso,
                pesoLiquido: i.peso,
                valor: i.valor
            };
        }
    });

    payloadUpdate.transporte = {
        ...(_state.currentPedidoBlingBruto.transporte || {}),
        fretePorConta: fretePorConta,
        frete: frete,
        quantidadeVolumes: volumes,
        pesoBruto: pesoBruto,
        pesoLiquido: pesoLiquido
    };

    if (transportadoraIdStr || transportadoraNome) {
        payloadUpdate.transporte.contato = {};
        if (transportadoraIdStr) payloadUpdate.transporte.contato.id = parseInt(transportadoraIdStr);
        if (transportadoraNome) payloadUpdate.transporte.contato.nome = transportadoraNome;
    }

    if (descontoVal > 0) {
        payloadUpdate.desconto = { valor: descontoVal, unidade: 'REAL' };
    } else {
        payloadUpdate.desconto = { valor: 0, unidade: 'REAL' };
    }

    payloadUpdate.outrasDespesas = outrasDespesasVal > 0 ? outrasDespesasVal : 0;
    if (parcelas.length > 0) payloadUpdate.parcelas = parcelas;

    const saveBtn = document.getElementById('mobile-nfe-save-btn');
    const originalSaveHtml = saveBtn ? saveBtn.innerHTML : '';

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Salvando...</span>`;
        }

        // 1. Atualiza dados fiscais do contato primeiro
        if (_state.currentContatoBruto && contatoId) {
            const contatoPayload = {
                ..._state.currentContatoBruto,
                nome: contatoNome,
                tipo: contatoTipo,
                numeroDocumento: contatoCnpj,
                ie: contatoIe,
                indicadorIe: contatoContribuinte
            };
            if (contatoPayload.dadosAdicionais && contatoPayload.dadosAdicionais.dataNascimento === '0000-00-00') {
                contatoPayload.dadosAdicionais.dataNascimento = '';
            }

            try {
                const putContact = await fetch(`${API_URLS.ORDERS_BLING}/contatos/${contatoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(contatoPayload)
                });
                if (!putContact.ok) {
                    const cErr = await putContact.json().catch(() => ({}));
                    console.warn('[nfeMobile] Aviso ao atualizar contato no Bling:', cErr);
                }
            } catch (errContact) {
                console.warn('[nfeMobile] Erro de rede ao atualizar contato:', errContact);
            }
        }

        // 2. Atualiza a venda no Bling
        const res = await fetch(`${API_URLS.ORDERS_BLING}/vendas/${idPedido}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadUpdate)
        });

        if (!res.ok) {
            const errResult = await res.json().catch(() => ({}));
            let isIdentical = false;
            if (errResult.details?.error?.fields) {
                isIdentical = errResult.details.error.fields.some(f =>
                    String(f.code) === '3' || (f.msg && f.msg.toLowerCase().includes('idêntica'))
                );
            }
            if (isIdentical) {
                if (!silent) alert('Pedido já está atualizado no Bling com estes dados.');
                return { success: true };
            }
            const errMsg = errResult.message || 'Falha ao atualizar pedido no Bling.';
            throw new Error(errMsg);
        }

        if (!silent) alert('Pedido atualizado com sucesso no Bling!');
        return { success: true };

    } catch (err) {
        console.error('[nfeMobile] Erro ao salvar pedido:', err);
        if (!silent) alert('Erro ao salvar pedido: ' + err.message);
        return { success: false, error: err.message };
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalSaveHtml;
        }
    }
}

// --- Emissão da NF-e para a SEFAZ ---

async function _handleEmitNfe() {
    const idPedido = _state.currentOrderId;
    if (!idPedido) return;

    // Detectar se há serviços
    const itemCards = document.querySelectorAll('.mobile-nfe-item-card');
    let hasService = false;
    itemCards.forEach(c => {
        const cod = (c.querySelector('.mobile-item-codigo')?.value || '').trim();
        if (cod.startsWith('7')) hasService = true;
    });

    const targetSituacaoId = hasService ? 37589 : 9;
    const situacaoLabel = hasService ? 'Atendido P. (Possui Serviços)' : 'Atendido';

    const confirmMsg = `Confirmar a emissão da Nota Fiscal na SEFAZ?\n\nO pedido será atualizado para: ${situacaoLabel}.`;
    if (!confirm(confirmMsg)) return;

    const overlay = document.getElementById('mobile-nfe-console-overlay');
    const logsContainer = document.getElementById('mobile-nfe-console-logs');
    const successArea = document.getElementById('mobile-nfe-console-success-area');
    const danfeLink = document.getElementById('mobile-nfe-danfe-link');
    const okBtn = document.getElementById('mobile-nfe-console-ok-btn');

    if (overlay) overlay.classList.remove('hidden');
    if (logsContainer) logsContainer.innerHTML = '';
    if (successArea) successArea.classList.add('hidden');

    function log(msg, type = 'info') {
        if (!logsContainer) return;
        const p = document.createElement('p');
        p.className = type === 'success' ? 'text-green-400 font-bold' : (type === 'error' ? 'text-red-400 font-bold' : 'text-gray-300');
        p.textContent = msg;
        logsContainer.appendChild(p);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    log(`1. Salvando alterações do pedido no Bling...`);
    const saveResult = await _saveOrderEdit(true, true);
    if (!saveResult || !saveResult.success) {
        log(`❌ Falha ao salvar pedido no Bling: ${saveResult?.error || 'Erro desconhecido'}`, 'error');
        if (successArea) successArea.classList.remove('hidden');
        if (danfeLink) danfeLink.classList.add('hidden');
        return;
    }
    log(`✓ Pedido salvo no Bling com sucesso!`, 'success');

    log(`2. Enviando solicitação de emissão de NF-e para a SEFAZ...`);

    try {
        const res = await fetch(`${API_URLS.ORDERS_BLING}/vendas/${idPedido}/gerar-nfe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                somenteGerar: false,
                situacaoId: targetSituacaoId,
                hasService: hasService
            })
        });

        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
            const errorMsg = result.message || 'Falha ao comunicar com SEFAZ.';
            log(`❌ Erro retornado: ${errorMsg}`, 'error');
            if (successArea) successArea.classList.remove('hidden');
            if (danfeLink) danfeLink.classList.add('hidden');
            return;
        }

        const idNota = result.data?.idNota || result.idNota || '';

        if (result.status === 'partial_success' || result.status === 'draft_success') {
            log(`⚠️ Nota criada no Bling (ID: ${idNota}), porém autorização na SEFAZ pendente.`, 'info');
            log(`Mensagem: ${result.message || ''}`);
        } else {
            log(`🚀 NF-e Gerada e Autorizada com Sucesso! (ID: ${idNota})`, 'success');
            log(`Status do pedido atualizado para: ${situacaoLabel}`, 'success');
        }

        // Atualiza pedido localmente
        const pedidoLocal = _state.allPedidos.find(p => String(p.id) === String(idPedido) || String(p.numero) === String(idPedido));
        if (pedidoLocal) {
            pedidoLocal.id_nota_fiscal = idNota;
            pedidoLocal.id_nota = idNota;
            pedidoLocal['id nota'] = idNota;
            const newSit = hasService ? 'Atendido P.' : 'Atendido';
            pedidoLocal.situação = newSit;
            pedidoLocal.situacao = newSit;
        }

        // Tentar obter DANFE link imediatamente ou em cache
        await fetchNfeListData();
        let pdfUrl = '';
        if (idNota) {
            const foundNfe = _state.allNfeData.find(n => String(n.id_nota || n.id) === String(idNota));
            if (foundNfe && (foundNfe.link_danfe || foundNfe['Link DANFE'])) {
                pdfUrl = foundNfe.link_danfe || foundNfe['Link DANFE'];
            }
        }
        if (!pdfUrl && idNota) {
            pdfUrl = `https://www.bling.com.br/notas.fiscais.php#edit/${idNota}`;
        }

        if (pdfUrl && danfeLink) {
            danfeLink.href = pdfUrl;
            danfeLink.classList.remove('hidden');
        }
        if (successArea) successArea.classList.remove('hidden');

    } catch (netErr) {
        log(`❌ Falha de rede: ${netErr.message}`, 'error');
        log(`Atenção: A nota pode ter sido enviada. Verifique no Bling.`, 'info');
        if (successArea) successArea.classList.remove('hidden');
        if (danfeLink) danfeLink.classList.add('hidden');
    }
}
