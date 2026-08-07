import { API_URLS } from './apiConfig.js';

// --- DOM Elements ---
const menuView = document.getElementById('menu-view');
const adjustView = document.getElementById('adjust-view');
const requisitionView = document.getElementById('requisition-view');
const goToAdjustBtn = document.getElementById('go-to-adjust-btn');
const goToRequisitionBtn = document.getElementById('go-to-requisition-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

// Adjust View Elements
const adjustBackToMenuBtn = document.getElementById('adjust-back-to-menu-btn');
const startScanBtn = document.getElementById('start-scan-btn');
const stopScanBtn = document.getElementById('stop-scan-btn');
const resultContainer = document.getElementById('result-container');
const productDescription = document.getElementById('product-description');
const productStock = document.getElementById('product-stock');
const newQuantityInput = document.getElementById('new-quantity');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const scannerContainer = document.getElementById('scanner-container');
const accordionToggle = document.getElementById('accordion-toggle');
const accordionContent = document.getElementById('accordion-content');
const accordionIcon = document.getElementById('accordion-icon');
const detailCodigo = document.getElementById('detail-codigo');
const detailCusto = document.getElementById('detail-custo');
const detailVenda = document.getElementById('detail-venda');
const detailEstoqueMinMax = document.getElementById('detail-estoque-min-max');
const detailLocalizacao = document.getElementById('detail-localizacao');
const detailTags = document.getElementById('detail-tags');

// Requisition View Elements
const reqBackToMenuBtn = document.getElementById('req-back-to-menu-btn');
const reqStartScanBtn = document.getElementById('req-start-scan-btn');
const reqStopScanBtn = document.getElementById('req-stop-scan-btn');
const reqScannerContainer = document.getElementById('req-scanner-container');
const requisitionListContainer = document.getElementById('requisition-list-container');
const launchFactoryBtn = document.getElementById('launch-factory-btn');
const launchTerceirosBtn = document.getElementById('launch-terceiros-btn');

// Entrada View Elements
const entradaView = document.getElementById('entrada-view');
const goToEntradaBtn = document.getElementById('go-to-entrada-btn');
const entradaBackToMenuBtn = document.getElementById('entrada-back-to-menu-btn');
const entradaStartScanBtn = document.getElementById('entrada-start-scan-btn');
const entradaStopScanBtn = document.getElementById('entrada-stop-scan-btn');
const entradaManualBtn = document.getElementById('entrada-manual-btn');
const entradaScannerContainer = document.getElementById('entrada-scanner-container');
const entradaFormContainer = document.getElementById('entrada-form-container');
const entradaChaveAcesso = document.getElementById('entrada-chave-acesso');
const entradaNumeroNota = document.getElementById('entrada-numero-nota');
const entradaDataEmissao = document.getElementById('entrada-data-emissao');
const entradaFornecedor = document.getElementById('entrada-fornecedor');
const entradaValorTotal = document.getElementById('entrada-valor-total');
const entradaObservacao = document.getElementById('entrada-observacao');
const entradaSaveBtn = document.getElementById('entrada-save-btn');
const entradaCancelBtn = document.getElementById('entrada-cancel-btn');

// Pedidos View Elements
const pedidosView = document.getElementById('pedidos-view');
const goToPedidosBtn = document.getElementById('go-to-pedidos-btn');
const pedidosBackToMenuBtn = document.getElementById('pedidos-back-to-menu-btn');
const pedidosSearchInput = document.getElementById('pedidos-search-input');
const pedidosStatusFilter = document.getElementById('pedidos-status-filter');
const pedidosListContainer = document.getElementById('pedidos-list-container');
const pedidosObsModal = document.getElementById('pedidos-obs-modal');
const pedidosObsModalInfo = document.getElementById('pedidos-obs-modal-info');
const pedidosObsHistory = document.getElementById('pedidos-obs-history');
const pedidosObsTextarea = document.getElementById('pedidos-obs-textarea');
const pedidosObsCharCount = document.getElementById('pedidos-obs-char-count');
const savePedidosObsBtn = document.getElementById('save-pedidos-obs-btn');
const closePedidosObsModalBtn = document.getElementById('close-pedidos-obs-modal-btn');
const pedidosObsItemSelect = document.getElementById('pedidos-obs-item-select');
const pedidosDetalhesModal = document.getElementById('pedidos-detalhes-modal');
const pedidosDetalhesHeader = document.getElementById('pedidos-detalhes-header');
const pedidosDetalhesContent = document.getElementById('pedidos-detalhes-content');
const closePedidosDetalhesModalBtn = document.getElementById('close-pedidos-detalhes-modal-btn');
const openObsFromDetalhesBtn = document.getElementById('open-obs-from-detalhes-btn');
const imageZoomModal = document.getElementById('image-zoom-modal');
const imageZoomImg = document.getElementById('image-zoom-img');
const closeImageZoomBtn = document.getElementById('close-image-zoom-btn');

// Producao View Elements
const producaoView = document.getElementById('producao-view');
const goToProducaoBtn = document.getElementById('go-to-producao-btn');
const producaoBackToMenuBtn = document.getElementById('producao-back-to-menu-btn');
const producaoResponsavelFilter = document.getElementById('producao-responsavel-filter');
const producaoListContainer = document.getElementById('producao-list-container');
const aguardandoListContainer = document.getElementById('aguardando-list-container');
const finalizadosListContainer = document.getElementById('finalizados-list-container');
const tabEmProducao = document.getElementById('tab-em-producao');
const tabAguardando = document.getElementById('tab-aguardando');
const tabFinalizados = document.getElementById('tab-finalizados');
let currentProducaoTab = 'EM_PRODUCAO';

// App State
let allProducts = [];
let allPedidos = [];
let filteredPedidos = [];
let adjustSelectedProduct = null;
let requisitionItems = [];
let adjustScanner, reqScanner, entradaScanner;
let db;
let currentObsOrderId = null;
const myClientId = sessionStorage.getItem('mks_client_id') || (()=>{ const id=Math.random().toString(36).substring(7); sessionStorage.setItem('mks_client_id', id); return id; })();
const DB_NAME = 'ajuste-estoque-db';
const STORE_NAME = 'pending-adjustments';

// --- Navigation & View Management ---
function showView(viewId) {
    menuView.classList.add('hidden');
    adjustView.classList.add('hidden');
    requisitionView.classList.add('hidden');
    entradaView.classList.add('hidden');
    pedidosView.classList.add('hidden');
    producaoView.classList.add('hidden');
    stopAllScanners();
    
    if (viewId === 'menu-view') {
        menuView.classList.remove('hidden');
        document.title = 'MKS Service';
    } else if (viewId === 'adjust-view') {
        adjustView.classList.remove('hidden');
        document.title = 'Ajuste de Estoque';
    } else if (viewId === 'requisition-view') {
        requisitionView.classList.remove('hidden');
        document.title = 'Criar Requisição';
        renderRequisitionList();
    } else if (viewId === 'entrada-view') {
        entradaView.classList.remove('hidden');
        document.title = 'Gerenciar Entrada';
    } else if (viewId === 'pedidos-view') {
        pedidosView.classList.remove('hidden');
        document.title = 'Pedidos';
        fetchAllProducts().then(() => fetchPedidos());
    } else if (viewId === 'producao-view') {
        producaoView.classList.remove('hidden');
        document.title = 'Produção';
        if (allPedidos.length === 0) {
            fetchPedidos().then(() => renderProducaoView());
        } else {
            renderProducaoView();
        }
    }
}

// --- Firestore Sync (Real-time) ---
let dbFirestore;
async function initFirestoreSync() {
    if (dbFirestore) return; // evitar re-inicialização
    
    const syncBadge = document.getElementById('sync-status-badge');
    const setSyncStatus = (status) => {
        if (!syncBadge) return;
        if (status === 'ON') {
            syncBadge.textContent = '🟢 SYNC';
            syncBadge.className = 'px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-600 font-bold border border-green-200';
        } else if (status === 'ERROR') {
            syncBadge.textContent = '⚠️ ERR';
            syncBadge.className = 'px-1.5 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-600 font-bold border border-yellow-200';
        } else {
            syncBadge.textContent = 'OFFLINE';
            syncBadge.className = 'px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-600 font-bold border border-red-200';
        }
    };

    console.log("[Firestore Sync] Inicializando sincronização em tempo real no Mobile...");
    
    try {
        const { initializeApp: initFB } = await import("firebase/app");
        const { initializeFirestore, doc, onSnapshot } = await import("firebase/firestore");

        const firebaseConfig = {
            projectId: "mksservice-71367430-58374"
        };

        const appFirebase = initFB(firebaseConfig);
        
        // Forçar Long-Polling para evitar problemas de conexão WebSocket em browsers de celular
        dbFirestore = initializeFirestore(appFirebase, {
            experimentalForceLongPolling: true
        });

        console.log("[Firestore Sync] Conectado ao Firestore (Mobile) com Long-Polling.");
        setSyncStatus('ON');

        const syncDocRef = doc(dbFirestore, "sync", "updates");
        onSnapshot(syncDocRef, (snapshot) => {
            if (snapshot.exists()) {
                const update = snapshot.data();
                console.log("[Firestore Sync] Nova atualização detectada no Mobile:", update.type, update);
                handleSyncUpdate(update);
            }
        }, (error) => {
            console.error("[Firestore Sync] Erro no listener Mobile:", error);
            setSyncStatus('ERROR');
        });

    } catch (error) {
        console.error("[Firestore Sync] Erro ao inicializar Firestore Sync no Mobile:", error);
        setSyncStatus('ERROR');
    }
}

function handleSyncUpdate(update) {
    const { type, data } = update;
    const syncBadge = document.getElementById('sync-status-badge');

    switch (type) {
        case 'orderObservationUpdated':
            console.log(`[Firestore Sync] Aviso recebido: Pedido ${data.numeroPedido} atualizado.`);
            
            // 1. Atualização Instantânea se os dados vierem no evento
            if (data.novaObservacao) {
                // IGNORAR SE FOR EU MESMO PARA EVITAR DUPLICIDADE
                if (data.senderId === myClientId) {
                    console.log("[Firestore Sync] Ignorando aviso próprio para evitar duplicidade.");
                    return;
                }

                console.log("[Firestore Sync] Sincronização direta recebida. Conteúdo:", data.novaObservacao);
                
                // Busca de pedido super-robusta (verifica qualquer identificador possível)
                const order = allPedidos.find(o => 
                    String(o.id) === String(data.numeroPedido) || 
                    String(o.id) === String(data.numero) ||
                    String(o.numero) === String(data.numeroPedido) ||
                    String(o.número) === String(data.numeroPedido)
                );

                if (order) {
                    console.log("[Firestore Sync] Pedido encontrado. Atualizando...");
                    // Split super robusto (detecta \n literal, \n escapado, etc)
                    const parsedObs = String(data.novaObservacao)
                        .split(/\n|\\n|\r\n|\\r\\n/)
                        .map(s => s.trim())
                        .filter(s => s !== '');
                    
                    order.observacao = parsedObs;
                    
                    const isVisible = pedidosObsModal && !pedidosObsModal.classList.contains('hidden');
                    const isSameOrder = String(currentObsOrderId) === String(data.numeroPedido) || 
                                      String(currentObsOrderId) === String(order.id) || 
                                      String(currentObsOrderId) === String(order.numero);

                    console.log(`[Firestore Sync] Modal aberto: ${isVisible}, Mesmo pedido: ${isSameOrder}`);

                    if (isVisible && isSameOrder) {
                        renderObservationChat(parsedObs);
                    } else {
                        renderPedidosList();
                    }
                } else {
                    console.warn(`[Firestore Sync] Pedido ${data.numeroPedido} não encontrado localmente.`);
                }
                return; 
            }

            // 2. Fallback: Se não vierem os dados diretamentre (ex: backend não migrado), faz o fetch
            console.log(`[Firestore Sync] Dados diretos ausentes. Iniciando fallback via re-busca em 1.5s...`);
            if (syncBadge) {
                syncBadge.textContent = '🔄 SYNCING';
                syncBadge.className = 'px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-600 font-bold border border-blue-200';
            }

            setTimeout(() => {
                fetchPedidos(true).then(() => {
                    console.log(`[Firestore Sync] Re-busca concluída. Verificando se o modal do pedido ${data.numeroPedido} está aberto...`);
                    
                    if (syncBadge) {
                        syncBadge.textContent = '🟢 SYNC';
                        syncBadge.className = 'px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-600 font-bold border border-green-200';
                    }

                    // Encontrar o pedido no novo array com a mesma lógica robusta
                    const order = allPedidos.find(o => 
                        String(o.id) === String(data.numeroPedido) || 
                        String(o.numero) === String(data.numeroPedido) ||
                        String(o.número) === String(data.numeroPedido)
                    );

                    if (order) {
                        const isVisible = pedidosObsModal && !pedidosObsModal.classList.contains('hidden');
                        const isSameOrder = String(currentObsOrderId) === String(data.numeroPedido) || 
                                          String(currentObsOrderId) === String(order.id) || 
                                          String(currentObsOrderId) === String(order.numero);

                        console.log(`[Firestore Sync Fallback] Modal: ${isVisible}, Mesmo pedido: ${isSameOrder} (ID Ativo: ${currentObsOrderId})`);

                        if (isVisible && isSameOrder) {
                            console.log('[Firestore Sync Fallback] Atualizando Chat UI...');
                            // Garantir que a observação recém-baixada esteja em formato de array
                            if (order.observacao && typeof order.observacao === 'string') {
                                order.observacao = order.observacao.split(/\\n|\n/).map(s => s.trim()).filter(s => s !== '');
                            }
                            renderObservationChat(order.observacao);
                        } else {
                            renderPedidosList();
                        }
                    }
                }).catch(err => {
                    console.error('[Firestore Sync Fallback] Erro ao re-buscar dados:', err);
                });
            }, 1500);
            break;
            
        case 'orderItemStatusUpdated':
            console.log(`[Firestore Sync] Aviso recebido: Status de Item do Pedido atualizado para ${data.newStatus}.`);
            const { pedidoId, itemCodigo, newStatus, itemIndex, newDescription, dataPedido, responsavel } = data;
            const pedido = allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId));
            if (pedido) {
                if (!pedido.detalhesProducao) pedido.detalhesProducao = {};
                const key = `${pedidoId}-${itemIndex}`;
                pedido.detalhesProducao[key] = {
                    status: newStatus || pedido.detalhesProducao[key]?.status || 'OK',
                    descricao: newDescription !== undefined ? newDescription : (pedido.detalhesProducao[key]?.descricao || ''),
                    data: dataPedido !== undefined ? dataPedido : (pedido.detalhesProducao[key]?.data || ''),
                    responsavel: responsavel !== undefined ? responsavel : (pedido.detalhesProducao[key]?.responsavel || '')
                };
                
                if (!producaoView.classList.contains('hidden')) {
                    renderProducaoView();
                }
            }
            break;
            
        case 'stockUpdated':
            console.log(`[Firestore Sync] Estoque do item ${data.codigo} atualizado para ${data.novoEstoque}`);
            // Atualiza memória local de produtos
            const product = allProducts.find(p => String(p.codigo) === String(data.codigo));
            if (product) {
                product.estoque = data.novoEstoque;
            }
            break;
    }
}

function stopAllScanners() {
    if (adjustScanner && adjustScanner.isScanning) adjustScanner.stop().catch(console.error);
    if (reqScanner && reqScanner.isScanning) reqScanner.stop().catch(console.error);
    if (entradaScanner && entradaScanner.isScanning) entradaScanner.stop().catch(console.error);
    scannerContainer.classList.add('hidden');
    stopScanBtn.classList.add('hidden');
    startScanBtn.classList.remove('hidden');
    reqScannerContainer.classList.add('hidden');
    reqStopScanBtn.classList.add('hidden');
    reqStartScanBtn.classList.remove('hidden');
    entradaScannerContainer.classList.add('hidden');
    entradaStopScanBtn.classList.add('hidden');
    entradaStartScanBtn.classList.remove('hidden');
}

// --- General Helpers & DB ---
function initDB() {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains(STORE_NAME)) e.target.result.createObjectStore(STORE_NAME, { autoIncrement: true }); };
    request.onsuccess = e => { db = e.target.result; console.log('DB inicializado.'); };
    request.onerror = e => console.error('DB erro:', e.target.error);
}

function saveAdjustmentToDB(payload) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB não disponível.');
        const tx = db.transaction([STORE_NAME], 'readwrite');
        tx.objectStore(STORE_NAME).add(payload).onsuccess = resolve;
        tx.onerror = e => reject(e.target.error);
    });
}

function toggleLoading(show, text = '') {
    loadingText.textContent = text;
    loadingOverlay.classList.toggle('hidden', !show);
}

function formatCurrency(value) {
    const num = parseFloat(String(value || '0').replace(',', '.'));
    return isNaN(num) ? "R$ 0,00" : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function fetchAllProducts() {
    if (allProducts.length > 0) return true;
    toggleLoading(true, 'Carregando produtos...');
    try {
        const res = await fetch(`${API_URLS.PRODUCTS}?t=${new Date().getTime()}`);
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        const data = await res.json();
        if (data.error || !data.data) throw new Error(data.message || 'Formato de dados inválido.');
        allProducts = data.data;
        return true;
    } catch (error) {
        alert(`Falha ao carregar produtos: ${error.message}`);
        return false;
    } finally {
        toggleLoading(false);
    }
}

// --- ADJUST STOCK LOGIC ---
async function onAdjustScanSuccess(decodedText) {
    stopAllScanners();
    adjustSelectedProduct = allProducts.find(p => p.codigo === decodedText);

    if (adjustSelectedProduct) {
        productDescription.textContent = adjustSelectedProduct.descricao;
        productStock.textContent = adjustSelectedProduct.estoque || 0;
        detailCodigo.textContent = adjustSelectedProduct.codigo || 'N/A';
        detailCusto.textContent = formatCurrency(adjustSelectedProduct.preco_de_custo);
        detailVenda.textContent = formatCurrency(adjustSelectedProduct.preco);
        detailEstoqueMinMax.textContent = `${adjustSelectedProduct.estoque_minimo || 0} / ${adjustSelectedProduct.estoque_maximo || 0}`;
        detailLocalizacao.textContent = adjustSelectedProduct.localizacao || 'N/A';
        const tags = adjustSelectedProduct.grupo_de_tags_tags;
        detailTags.textContent = (Array.isArray(tags) && tags.length > 0 && tags[0]) ? tags.join(', ') : 'Nenhuma';
        
        resultContainer.classList.remove('hidden');
        newQuantityInput.value = '';
        newQuantityInput.focus();
        accordionContent.classList.add('hidden');
        accordionIcon.classList.remove('rotate-180');
    } else {
        alert(`Produto com código "${decodedText}" não encontrado!`);
        startAdjustScan(); 
    }
}

async function startAdjustScan() {
    const productsLoaded = await fetchAllProducts();
    if(!productsLoaded) return;

    resultContainer.classList.add('hidden');
    scannerContainer.classList.remove('hidden');
    startScanBtn.classList.add('hidden');
    stopScanBtn.classList.remove('hidden');

    adjustScanner = new Html5Qrcode("reader");
    try {
        await adjustScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onAdjustScanSuccess, () => {});
    } catch (err) {
        alert("Erro ao iniciar a câmera. Verifique as permissões.");
        stopAllScanners();
    }
}

async function saveStockAdjustment() {
    if (!adjustSelectedProduct) return alert("Nenhum produto selecionado.");
    const newQuantity = parseFloat(String(newQuantityInput.value || '').replace(',', '.'));
    if (isNaN(newQuantity) || newQuantity < 0) return alert("Quantidade inválida.");
    
    let userName = 'AppMobile';
    try { userName = JSON.parse(localStorage.getItem('userInfo')).nome || userName; } catch(e){}

    const payload = {
        produto: { id: adjustSelectedProduct.id, codigo: adjustSelectedProduct.codigo },
        operacaoBling: "B", quantidadeFinal: newQuantity, tipoEntrada: "Balanço",
        observacoes: `Ajuste de balanço via AppMobile por '''${userName}'''`,
        quantidadeMovimento: 0, orderCode: 'BALANCO', codigoService: adjustSelectedProduct.codigo,
        newStatus: 'N/A', requisitionType: 'balanco', dataEntrega: new Date().toLocaleDateString('pt-BR'),
        diasCorridos: '0'
    };

    toggleLoading(true, 'Salvando...');
    try {
        const res = await fetch(API_URLS.ORDERS_UPDATE, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Erro da API: ${res.status}`);
        await res.json();
        alert(`Estoque ajustado para ${newQuantity}!`);
        allProducts = []; 
        cancelAdjustAndRescan();
    } catch (error) {
        console.error("Falha ao enviar:", error);
        if (!navigator.onLine && 'serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                await saveAdjustmentToDB(payload);
                const swReg = await navigator.serviceWorker.ready;
                await swReg.sync.register('sync-adjustments');
                alert(`Sem conexão. Ajuste salvo localmente e será enviado depois.`);
                cancelAdjustAndRescan();
            } catch (dbError) {
                alert(`Falha ao salvar localmente: ${dbError.message}.`);
            }
        } else {
            alert(`Falha ao ajustar estoque: ${error.message}.`);
        }
    } finally {
        toggleLoading(false);
    }
}

function cancelAdjustAndRescan() {
    resultContainer.classList.add('hidden');
    newQuantityInput.value = '';
    adjustSelectedProduct = null;
    startAdjustScan();
}

// --- REQUISITION LOGIC ---
async function onReqScanSuccess(decodedText) {
    if (reqScanner && reqScanner.isScanning) {
        await reqScanner.stop();
    }

    const product = allProducts.find(p => p.codigo === decodedText);

    if (product) {
        const quantityStr = prompt(`Adicionar à requisição:
${product.descricao}

Quantidade:`, "1");
        if (quantityStr) {
            const quantity = parseInt(quantityStr, 10);
            if (!isNaN(quantity) && quantity > 0) {
                const existingItem = requisitionItems.find(item => item.id === product.id);
                if (existingItem) {
                    existingItem.quantity += quantity;
                } else {
                    requisitionItems.push({ ...product, quantity });
                }
                renderRequisitionList();
            } else {
                alert("Quantidade inválida.");
            }
        }
    } else {
        alert(`Produto com código "${decodedText}" não encontrado!`);
    }
    
    if (!reqScannerContainer.classList.contains('hidden')) {
        startReqScan();
    }
}

async function startReqScan() {
    const productsLoaded = await fetchAllProducts();
    if (!productsLoaded) return;

    reqScannerContainer.classList.remove('hidden');
    reqStartScanBtn.classList.add('hidden');
    reqStopScanBtn.classList.remove('hidden');

    reqScanner = new Html5Qrcode("req-reader");
    try {
        await reqScanner.start(
            { facingMode: "environment" }, 
            { fps: 5, qrbox: { width: 250, height: 250 } }, 
            onReqScanSuccess, 
            () => {}
        );
    } catch (err) {
        alert("Erro ao iniciar a câmera. Verifique as permissões.");
        stopAllScanners();
    }
}

function renderRequisitionList() {
    requisitionListContainer.innerHTML = '';
    if (requisitionItems.length === 0) {
        requisitionListContainer.innerHTML = `<p class="text-gray-500 text-center">Nenhum item adicionado.</p>`;
        return;
    }
    requisitionItems.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center p-2 border-b';
        itemDiv.innerHTML = `
            <div class="flex-grow"><p class="font-semibold">${item.descricao}</p><p class="text-sm text-gray-600">Código: ${item.codigo}</p></div>
            <div class="text-right ml-2"><p class="font-bold text-lg">${item.quantity}</p></div>
            <button data-index="${index}" class="ml-4 text-red-500 hover:text-red-700 p-1">
                <svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>`;
        requisitionListContainer.appendChild(itemDiv);
    });
}

function handleRequisitionListClick(event) {
    const button = event.target.closest('button[data-index]');
    if (button) {
        const index = parseInt(button.getAttribute('data-index'), 10);
        if (confirm(`Remover "${requisitionItems[index].descricao}" da lista?`)) {
            requisitionItems.splice(index, 1);
            renderRequisitionList();
        }
    }
}

async function launchRequisition(type) {
    if (requisitionItems.length === 0) return alert("A lista de requisição está vazia.");

    // VALIDAÇÃO CORRIGIDA: Checa se o código do produto começa com '6' (Fábrica) ou '5' (Terceiros)
    const isFabrica = type === 'fabrica';
    const expectedStartChar = isFabrica ? '6' : '5';
    const typeName = isFabrica ? 'Fábrica' : 'Terceiros';
    
    const isValid = requisitionItems.every(item => item.codigo && String(item.codigo).startsWith(expectedStartChar));

    if (!isValid) {
        const invalidItems = requisitionItems.filter(item => !(item.codigo && String(item.codigo).startsWith(expectedStartChar)));
        const invalidItemCodes = invalidItems.map(item => `${item.codigo} (${item.descricao.substring(0, 15)}...)`).join('');
        const errorMessage = `Todos os itens para uma requisição de '${typeName}' devem ter códigos iniciados com '${expectedStartChar}'.\n\nItens inválidos:\n${invalidItemCodes}`;
        return alert(errorMessage);
    }

    let userName = 'AppMobile';
    try { userName = JSON.parse(localStorage.getItem('userInfo')).nome || userName; } catch(e){}

    const payload = {
        requisitionType: type,
        observacoes: `Requisição via AppMobile por "${userName}"`,
        items: requisitionItems.map(item => ({
            id: item.id,
            codigo: item.codigo,
            descricao: item.descricao,
            quantidade: item.quantity,
            situacao: 'PENDENTE'
        }))
    };

    toggleLoading(true, 'Lançando Requisição...');
    try {
        const url = `${API_URLS.WEBHOOK_LAUNCH}/requisition`;
        const response = await fetch(url, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Erro da API: ${response.status}`);
        await response.json();
        
        alert('Requisição lançada com sucesso!');
        requisitionItems = []; 
        showView('menu-view'); 

    } catch (error) {
        console.error("Falha ao lançar requisição:", error);
        alert(`Não foi possível lançar a requisição: ${error.message}`);
    } finally {
        toggleLoading(false);
    }
}

// --- ENTRADA NF-e LOGIC ---

/**
 * Extrai a chave de acesso NF-e de uma URL de QR Code de NF-e.
 * A chave fica no paramâmetro 'chNFe' da URL.
 * Se não for uma URL, assume que o código escaneado é a chave diretamente.
 */
function extrairChaveNFe(decodedText) {
    try {
        const url = new URL(decodedText);
        const chave = url.searchParams.get('chNFe');
        if (chave && chave.length === 44) return chave;
    } catch (e) {
        // Não é uma URL válida
    }
    // Verifica se é diretamente uma chave de 44 dígitos
    const somenteNumeros = decodedText.replace(/\D/g, '');
    if (somenteNumeros.length === 44) return somenteNumeros;
    return null;
}

/**
 * Decoda a data de emissão da chave NF-e.
 * Posições 2-5 da chave = AAMM (ano/mês)
 * Posições 6-7 = CNPJ começa na posição 6, então a data está em [2..5]
 */
function extrairDataEmissao(chave) {
    try {
        if (!chave || chave.length < 10) return '';
        // Chave: cUF(2) + AAMM(4) + CNPJ(14) + ...
        const aamm = chave.substring(2, 6); // ex: "2503" = março de 2025
        const ano = '20' + aamm.substring(0, 2);
        const mes = aamm.substring(2, 4);
        return `${mes}/${ano}`;
    } catch (e) {
        return '';
    }
}

/**
 * Extrai o número da NF-e (nNF) e o CNPJ da chave.
 * Posições da chave:
 * cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
 */
function extrairDadosChave(chave) {
    if (!chave || chave.length !== 44) return null;
    const mesAno = extrairDataEmissao(chave);
    const cnpj = chave.substring(6, 20);
    const nNFStr = chave.substring(25, 34);
    const nNF = parseInt(nNFStr, 10).toString(); // remove zeros à esquerda
    return { mesAno, cnpj, nNF };
}

async function buscarFornecedor(cnpj) {
    try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
        if (!res.ok) return '';
        const data = await res.json();
        return data.nome_fantasia || data.razao_social || '';
    } catch (e) {
        return '';
    }
}

async function onEntradaScanSuccess(decodedText) {
    stopAllScanners();
    const chave = extrairChaveNFe(decodedText);

    if (!chave) {
        alert(`QR Code não reconhecido como Nota Fiscal.\nTente novamente ou verifique se é um QR Code NF-e válido.`);
        return;
    }

    // Exibe o formulário e aciona a extração de dados
    entradaFormContainer.classList.remove('hidden');
    entradaChaveAcesso.value = chave;
    const event = new Event('input', { bubbles: true });
    entradaChaveAcesso.dispatchEvent(event);
    
    entradaFornecedor.focus();
}

async function startEntradaScan() {
    entradaFormContainer.classList.add('hidden');
    entradaScannerContainer.classList.remove('hidden');
    entradaStartScanBtn.classList.add('hidden');
    entradaStopScanBtn.classList.remove('hidden');

    entradaScanner = new Html5Qrcode("entrada-reader");
    try {
        await entradaScanner.start(
            { facingMode: "environment" },
            {
                fps: 10,
                // Box retangular: ideal para código de barras linear (Code 128) do DANFE
                qrbox: { width: 320, height: 100 },
                // Habilita QR Code E Code 128 (barcode DANFE)
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                ]
            },
            onEntradaScanSuccess,
            () => {}
        );
    } catch (err) {
        alert("Erro ao iniciar a câmera. Verifique as permissões.");
        stopAllScanners();
    }
}

async function saveEntrada() {
    const chave = entradaChaveAcesso.value.trim();
    const fornecedor = entradaFornecedor.value.trim();

    if (!chave) return alert('Chave de acesso não encontrada. Faça o scan novamente.');
    if (!fornecedor) return alert('Por favor, informe o Fornecedor.');

    let userName = 'AppMobile';
    try { userName = JSON.parse(localStorage.getItem('userInfo')).nome || userName; } catch(e){}

    const today = new Date();
    const dataRegistro = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;

    const payload = {
        dataRegistro,
        chaveAcesso: chave,
        numeroNota: entradaNumeroNota.value.trim(),
        dataEmissao: entradaDataEmissao.value.trim(),
        fornecedor,
        valorTotal: parseFloat(entradaValorTotal.value) || 0,
        observacao: entradaObservacao.value.trim(),
        registradoPor: userName
    };

    toggleLoading(true, 'Registrando entrada...');
    try {
        const res = await fetch(API_URLS.ENTRADAS_NOTA, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Erro da API: ${res.status}`);
        await res.json();
        alert('✅ Entrada de NF registrada com sucesso!');
        entradaFormContainer.classList.add('hidden');
        showView('menu-view');
    } catch (error) {
        console.error('Falha ao registrar entrada:', error);
        alert(`Falha ao registrar: ${error.message}`);
    } finally {
        toggleLoading(false);
    }
}

// --- PEDIDOS LOGIC ---

async function fetchPedidos(silent = false) {
    if (!silent) toggleLoading(true, "Buscando pedidos...");
    try {
        const url = `${API_URLS.ORDERS_BLING}?t=${Date.now()}`;
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error("Erro ao buscar pedidos.");
        const result = await response.json();
        allPedidos = result.data || [];
        
        // Garantir parsing de observação em todos os pedidos trazidos
        allPedidos.forEach(order => {
            if (order.observacao && typeof order.observacao === 'string') {
                order.observacao = order.observacao.split(/\\n|\n/).map(s => s.trim()).filter(s => s !== '');
            }
        });

        filterPedidos();
        return allPedidos;
    } catch (error) {
        console.error(error);
        if (!silent) alert("Não foi possível carregar os pedidos.");
    } finally {
        if (!silent) toggleLoading(false);
    }
}

function filterPedidos() {
    const term = (pedidosSearchInput.value || '').toLowerCase();
    const statusFilter = pedidosStatusFilter.value;

    filteredPedidos = allPedidos.filter(p => {
        const numero = String(p.número || p.numero || '').toLowerCase();
        const cliente = String(p.contato_nome || p['contato nome'] || p.cliente || '').toLowerCase();
        const vendedor = String(p.vendedor || '').toLowerCase();
        
        let statusMatch = true;
        if (statusFilter !== 'all') {
            const sitLower = (p.situação || p.situacao || '').toLowerCase();
            if (statusFilter === 'atendido') {
                statusMatch = (sitLower.includes('atendid') || sitLower.includes('entregue') || sitLower.includes('conclu'));
            } else if (statusFilter === 'aberto') {
                statusMatch = (sitLower.includes('abert') || sitLower.includes('pendent') || sitLower.includes('andamento'));
            } else if (statusFilter === 'producao') {
                statusMatch = sitLower.includes('produ');
            } else if (statusFilter === 'cancelado') {
                statusMatch = sitLower.includes('cancel');
            }
        }

        const orcamento = String(p.orcamento || p.orçamento || '').toLowerCase();
        const termMatch = numero.includes(term) || cliente.includes(term) || vendedor.includes(term) || orcamento.includes(term);
        return statusMatch && termMatch;
    });

    renderPedidosList();
}

function renderPedidosList() {
    pedidosListContainer.innerHTML = '';

    if (filteredPedidos.length === 0) {
        pedidosListContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum pedido encontrado.</p>';
        return;
    }

    const sorted = [...filteredPedidos].sort((a, b) => {
        const dateA = new Date(a.data || a.data_criacao || 0);
        const dateB = new Date(b.data || b.data_criacao || 0);
        return dateB - dateA;
    });

    sorted.forEach(p => {
        const numero = p.número || p.numero || '-';
        const cliente = p.contato_nome || p['contato nome'] || p.cliente || '-';
        const situacao = p.situação || p.situacao || '-';
        const totalVal = parseFloat(p.total_pedido || p['total pedido'] || p.total || 0);
        const totalFmt = formatCurrency(totalVal);
        const dataStr = p.data || p.data_criacao || '';
        
        let badgeClass = 'bg-gray-100 text-gray-800';
        const sitLower = situacao.toLowerCase();
        if (sitLower.includes('atendid') || sitLower.includes('entregue') || sitLower.includes('conclu')) badgeClass = 'bg-green-100 text-green-800';
        else if (sitLower.includes('cancel')) badgeClass = 'bg-red-100 text-red-800';
        else if (sitLower.includes('pendent') || sitLower.includes('abert') || sitLower.includes('andamento')) badgeClass = 'bg-yellow-100 text-yellow-800';
        else if (sitLower.includes('produ')) badgeClass = 'bg-blue-100 text-blue-800';

        const orcamento = p.orcamento || p.orçamento || '';

        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col space-y-2 active:bg-gray-50 transition-colors cursor-pointer';
        
        const hasObs = Array.isArray(p.observacao) && p.observacao.length > 0;
        const obsIcon = hasObs ? `
            <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z" clip-rule="evenodd"></path>
            </svg>
        ` : '';

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-2">
                    <span class="text-blue-600 font-bold text-lg">#${numero}</span>
                    ${orcamento ? `<span class="text-xs text-gray-400 font-medium">(${orcamento})</span>` : ''}
                    ${obsIcon}
                </div>
                <span class="px-2 py-1 text-[10px] font-bold uppercase rounded-full ${badgeClass}">${situacao}</span>
            </div>
            <div>
                <p class="font-semibold text-gray-800">${cliente}</p>
                <p class="text-xs text-gray-400">${dataStr}</p>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-gray-50">
                <span class="text-xs text-gray-500">Valor Total</span>
                <span class="font-bold text-gray-800">${totalFmt}</span>
            </div>
        `;

        card.addEventListener('click', () => openOrderDetailsModal(p.id || p.numero));
        pedidosListContainer.appendChild(card);
    });
}

// --- OBSERVATION & DETAILS FUNCTIONS ---

function openOrderDetailsModal(orderId) {
    const order = allPedidos.find(o => String(o.id) === String(orderId) || String(o.numero) === String(orderId));
    if (!order) {
        alert("Pedido não encontrado.");
        return;
    }

    currentObsOrderId = orderId; 
    
    const numero = order.numero || '-';
    const cliente = order.contato_nome || order['contato nome'] || order.cliente || '-';
    const situacao = order.situação || order.situacao || '-';
    const total = formatCurrency(parseFloat(order.total_pedido || order['total pedido'] || order.total || 0));
    
    // Header
    pedidosDetalhesHeader.innerHTML = `
        <div class="flex flex-col space-y-1 mt-2">
            <p><strong>Cliente:</strong> ${cliente}</p>
            <div class="flex justify-between items-center text-xs mt-1">
                <p>Status: <span class="capitalize font-bold">${situacao}</span></p>
                <p>Total: <span class="text-blue-600 font-bold text-sm">${total}</span></p>
            </div>
        </div>
    `;

    // Items
    const itensRaw = order.itens || order.Itens || '';
    const itemList = parseOrderItems(itensRaw);

    let itemsHtml = '';
    if (itemList.length > 0) {
        itemsHtml = itemList.map(item => {
            // Try to find description in cached products, or just show code
            const product = allProducts.find(p => String(p.codigo) === String(item.codigo));
            const descricao = product && product.descricao ? product.descricao : `Código do Item: ${item.codigo}`;
            const imgUrl = (product && product.url_imagens_externas && product.url_imagens_externas[0]) ? product.url_imagens_externas[0] : 'https://placehold.co/48x48/e2e8f0/64748b?text=Sem+Foto';
            const quantidade = item.quantidade;
            const valorUnitario = formatCurrency(item.valor);
            
            return `
                <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <img src="${imgUrl}" 
                         class="w-14 h-14 rounded-lg object-cover bg-gray-100 shrink-0 cursor-pointer border border-gray-200" 
                         onclick="openImageModal('${imgUrl}')"
                         onerror="this.src='https://placehold.co/48x48/e2e8f0/64748b?text=?'" />
                    <div class="flex-grow flex flex-col">
                        <span class="font-medium text-gray-800 text-sm mb-1 leading-tight">${descricao}</span>
                        <div class="flex justify-between items-center text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded-lg">
                            <span>Qtd: <b>${quantidade}</b></span>
                            <span>Unid: <b>${valorUnitario}</b></span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        itemsHtml = '<p class="text-center text-gray-500 text-sm py-8">Nenhum item encontrado.</p>';
    }

    pedidosDetalhesContent.innerHTML = itemsHtml;
    pedidosDetalhesModal.classList.remove('hidden');
}

function parseOrderItems(raw) {
    const results = [];
    if (!raw || raw === 'undefined' || raw === 'null') return results;
    
    const cleaned = String(raw).trim();
    const regex = /\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(cleaned)) !== null) {
        const parts = match[1].split(',').map(s => s.trim());
        if (parts.length >= 3) {
            results.push({
                codigo: parts[0],
                quantidade: parseFloat(parts[1]) || 1,
                valor: parseFloat(String(parts[2]).replace(',', '.')) || 0
            });
        } else if (parts.length === 2) {
            results.push({ codigo: parts[0], quantidade: parseFloat(parts[1]) || 1, valor: 0 });
        }
    }
    // Fallback se não tiver parênteses (ex: "codigo, qtd, valor")
    if (results.length === 0 && cleaned) {
        const parts = cleaned.replace(/[()]/g, '').split(',').map(s => s.trim());
        if (parts.length >= 3) {
            results.push({ 
                codigo: parts[0], 
                quantidade: parseFloat(parts[1]) || 1, 
                valor: parseFloat(String(parts[2]).replace(',', '.')) || 0 
            });
        }
    }
    return results;
}

function openOrderObservationModal(orderId) {
    const order = allPedidos.find(o => String(o.id) === String(orderId) || String(o.numero) === String(orderId));
    if (!order) {
        alert("Pedido não encontrado.");
        return;
    }

    currentObsOrderId = orderId;
    pedidosObsModal.dataset.orderId = orderId;
    pedidosObsModalInfo.innerHTML = `Pedido Nº: <b>${order.numero || 'N/A'}</b>`;
    
    // Popular o select de itens
    if (pedidosObsItemSelect) {
        pedidosObsItemSelect.innerHTML = '<option value="">Geral (Sem item específico)</option>';
        const itensRaw = order.itens || order.Itens || '';
        const itemList = parseOrderItems(itensRaw);
        
        if (itemList.length > 0) {
            itemList.forEach(item => {
                const product = allProducts.find(p => String(p.codigo) === String(item.codigo));
                const descricao = product && product.descricao ? product.descricao : `Item Cód: ${item.codigo}`;
                
                const opt = document.createElement('option');
                opt.value = `[${descricao}]`;
                opt.textContent = `${descricao} (Qtd: ${item.quantidade})`;
                pedidosObsItemSelect.appendChild(opt);
            });
            pedidosObsItemSelect.classList.remove('hidden');
        } else {
            pedidosObsItemSelect.classList.add('hidden');
        }
        pedidosObsItemSelect.value = ''; // seleciona o "Geral" por padrão
    }

    if (order.observacao && typeof order.observacao === 'string') {
        order.observacao = order.observacao
            .split(/\\n|\n/)
            .map(s => s.trim())
            .filter(s => s !== '');
    }

    renderObservationChat(order.observacao);
    pedidosObsTextarea.value = '';
    updateObservationCharCount();
    pedidosObsModal.classList.remove('hidden');
    pedidosObsTextarea.focus();
}

function renderObservationChat(observations) {
    if (!pedidosObsHistory) return;
    
    if (!observations || !Array.isArray(observations) || observations.length === 0) {
        pedidosObsHistory.innerHTML = '<p class="text-center text-gray-400 py-8 text-sm italic">Nenhuma observação registrada.</p>';
        return;
    }

    pedidosObsHistory.innerHTML = observations.map(obsString => {
        const parts = obsString.split(' - ');
        const timestamp = parts.length > 1 ? parts[0] : '';
        const message = parts.length > 1 ? parts.slice(1).join(' - ') : obsString;

        return `
            <div class="p-3 rounded-2xl bg-orange-50 text-gray-800 max-w-[85%] self-start border border-orange-100 shadow-sm">
                <p class="text-sm whitespace-pre-wrap">${message}</p>
                <div class="flex items-center justify-end mt-1 gap-1">
                    <span class="text-[10px] text-gray-400">${timestamp}</span>
                    <svg class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
            </div>
        `;
    }).join('');
    
    // Auto-scroll para o final
    setTimeout(() => {
        pedidosObsHistory.scrollTop = pedidosObsHistory.scrollHeight;
    }, 100);
}

async function saveOrderObservation() {
    const orderId = currentObsOrderId;
    let newObservation = pedidosObsTextarea.value;
    
    if (!orderId || !newObservation.trim()) return;
    
    // Adicionar a referência do item ao comentário, se selecionado
    if (pedidosObsItemSelect && pedidosObsItemSelect.value) {
        newObservation = `${pedidosObsItemSelect.value} - ${newObservation.trim()}`;
    }

    const orderToUpdate = allPedidos.find(o => String(o.id) === String(orderId) || String(o.numero) === String(orderId));
    if (!orderToUpdate) return;

    savePedidosObsBtn.disabled = true;
    loadingOverlay.classList.remove('hidden');
    loadingText.textContent = 'Enviando observação...';

    try {
        const payload = { 
            numero_do_pedido: orderId, 
            observacao: newObservation,
            senderId: myClientId
        };
        const response = await fetch(API_URLS.ORDER_OBSERVATION, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Status: ${response.status}`);

        const result = await response.json();
        if (result.data && result.data.newObservation) {
            const newHistoryAsString = result.data.newObservation;
            orderToUpdate.observacao = newHistoryAsString.split('\n').filter(line => line.trim() !== '');
            renderObservationChat(orderToUpdate.observacao);
            pedidosObsTextarea.value = '';
            updateObservationCharCount();
            
            // Atualizar ícone na lista
            renderPedidosList();
        }
    } catch (error) {
        console.error("Erro ao salvar observação:", error);
        alert(`Erro ao salvar observação: ${error.message}`);
    } finally {
        savePedidosObsBtn.disabled = false;
        loadingOverlay.classList.add('hidden');
    }
}

function updateObservationCharCount() {
    if (!pedidosObsTextarea || !pedidosObsCharCount) return;
    pedidosObsCharCount.textContent = pedidosObsTextarea.value.length;
}

window.openImageModal = function(url) {
    if (!url || url.includes('placehold.co')) return;
    imageZoomImg.src = url;
    imageZoomModal.classList.remove('hidden');
}

// --- PRODUÇÃO LOGIC ---

function _parseNumber(str) {
    if (!str) return null;
    let s = String(str).trim();
    if (s.includes('R$')) s = s.replace('R$', '').trim();
    if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

function _parseItens(raw, producaoData = {}, pedidoId = '') {
    const results = [];
    if (!raw) return results;

    const itemStrings = String(raw).split(/(?=\([^,]+,\s*\d+)/).filter(Boolean);

    itemStrings.forEach((itemStr, index) => {
        let content = itemStr.trim();
        if (!content) return;

        if (content.startsWith('(')) content = content.substring(1).trim();
        if (content.endsWith(')')) {
            const openCount = (content.match(/\(/g) || []).length;
            const closeCount = (content.match(/\)/g) || []).length;
            if (closeCount > openCount) content = content.substring(0, content.length - 1).trim();
        }

        const parts = content.split(',').map(s => s.trim());
        if (parts.length >= 3) {
            const sku = parts[0];
            const qty = parseFloat(parts[1]) || 1;
            let valPart = parts[2];
            let status = 'OK';
            
            if (valPart.includes('|')) {
                const sub = valPart.split('|');
                valPart = sub[0];
                status = sub[1] || 'OK';
            }

            const key = `${pedidoId}-${index}`;
            const extra = producaoData[key];
            
            results.push({
                codigo: sku,
                quantidade: qty,
                valor: _parseNumber(valPart) || 0,
                status: (extra && extra.status) ? extra.status : status,
                descricaoPersonalizada: (extra && extra.descricao) ? extra.descricao : '',
                dataProducao: (extra && extra.data) ? extra.data : '',
                responsavel: (extra && extra.responsavel) ? extra.responsavel : '',
                index: index
            });
        }
    });
    return results;
}

function _getStatusLabel(sit) {
    if (!sit) return 'ABERTO';
    const s = String(sit).toLowerCase().trim();
    if (s.includes('atendid') || s.includes('entregue') || s.includes('conclu')) return 'ATENDIDO';
    if (s.includes('produ')) return 'EM PRODUÇÃO';
    if (s.includes('cancel')) return 'CANCELADO';
    return 'ABERTO';
}

function renderProducaoView() {
    producaoListContainer.innerHTML = '';
    aguardandoListContainer.innerHTML = '';
    finalizadosListContainer.innerHTML = '';
    
    const aggregatedItems = {};

    allPedidos.forEach(p => {
        const numeroPedido = p.numero || p.número || 'N/A';
        const finalId = p.id_pedido || p.id || '';
        const itensRaw = p.itens || p.Itens || '';
        const parsedItens = _parseItens(itensRaw, p.detalhesProducao || {}, finalId);
        const empresa = p.contato_nome || p['contato nome'] || p.cliente || 'N/A';

        parsedItens.forEach(item => {
            const s = String(item.status || 'OK').toUpperCase().trim();
            const isProducao = s === 'EM PRODUÇÃO' || s === 'PRODUCAO' || s === 'EM PRODUCAO' || s === 'AGUARDANDO RETIRADA' || s === 'FINALIZADO';

            if (isProducao) {
                const codigo = String(item.codigo).trim();
                const key = `${codigo}_${numeroPedido}_${item.descricaoPersonalizada || ''}`; 
                
                if (!aggregatedItems[key]) {
                    aggregatedItems[key] = {
                        codigo: codigo,
                        descricao: item.descricaoPersonalizada || codigo, 
                        quantidadeTotal: 0,
                        data: item.dataProducao || p.data || '',
                        empresa: empresa,
                        numeroPedido: numeroPedido,
                        pedidoId: finalId,
                        itemIndex: item.index,
                        status: item.status || 'EM PRODUÇÃO',
                        responsavel: item.responsavel || ''
                    };
                }
                aggregatedItems[key].quantidadeTotal += (parseFloat(item.quantidade) || 0);
            }
        });
    });

    let itemsArray = Object.values(aggregatedItems);

    const responsaveisSet = new Set();
    itemsArray.forEach(item => {
        if (item.responsavel && item.responsavel.trim() !== '') {
            responsaveisSet.add(item.responsavel.trim());
        }
    });
    const responsaveis = Array.from(responsaveisSet).sort();

    const currentSelection = producaoResponsavelFilter.value || 'TODOS';
    let optionsHTML = '<option value="TODOS">Todos os Responsáveis</option><option value="SEM_RESP">Sem Responsável</option>';
    responsaveis.forEach(resp => {
        optionsHTML += `<option value="${resp}">${resp}</option>`;
    });
    producaoResponsavelFilter.innerHTML = optionsHTML;
    if (currentSelection === 'SEM_RESP' || responsaveis.includes(currentSelection)) {
        producaoResponsavelFilter.value = currentSelection;
    } else {
        producaoResponsavelFilter.value = 'TODOS';
    }

    if (producaoResponsavelFilter.value !== 'TODOS') {
        const activeFilter = producaoResponsavelFilter.value;
        if (activeFilter === 'SEM_RESP') {
            itemsArray = itemsArray.filter(i => !i.responsavel || i.responsavel.trim() === '');
        } else {
            itemsArray = itemsArray.filter(i => i.responsavel === activeFilter);
        }
    }

    const emProducaoItems = itemsArray.filter(i => i.status.toUpperCase() === 'EM PRODUÇÃO' || i.status.toUpperCase() === 'PRODUCAO' || i.status.toUpperCase() === 'EM PRODUCAO');
    const aguardandoItems = itemsArray.filter(i => i.status.toUpperCase() === 'AGUARDANDO RETIRADA');
    const finalizadosItems = itemsArray.filter(i => i.status.toUpperCase() === 'FINALIZADO');

    if (emProducaoItems.length === 0) {
        producaoListContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum item em produção.</p>';
    } else {
        producaoListContainer.innerHTML = emProducaoItems.map(item => _generateProducaoCardHtml(item)).join('');
    }

    if (aguardandoItems.length === 0) {
        aguardandoListContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum item aguardando retirada.</p>';
    } else {
        aguardandoListContainer.innerHTML = aguardandoItems.map(item => _generateProducaoCardHtml(item)).join('');
    }

    if (finalizadosItems.length === 0) {
        finalizadosListContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum item finalizado.</p>';
    } else {
        finalizadosListContainer.innerHTML = finalizadosItems.map(item => _generateProducaoCardHtml(item)).join('');
    }
}

function _generateProducaoCardHtml(item) {
    const s = String(item.status || '').toUpperCase().trim();
    let isFinalizado = s === 'FINALIZADO';
    let isAguardando = s === 'AGUARDANDO RETIRADA';
    let isProducao = s === 'EM PRODUÇÃO' || s === 'PRODUCAO' || s === 'EM PRODUCAO';
    
    let cardClass = '';
    let statusBadge = '';
    let nextStatus = '';
    let btnClass = '';
    let btnIcon = '';
    
    if (isFinalizado) {
        cardClass = 'border-green-300 bg-green-50';
        statusBadge = '<span class="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded-full ml-2">FINALIZADO</span>';
        nextStatus = 'EM PRODUÇÃO'; // Botão volta pra produção
        btnClass = 'bg-green-100 text-green-600 hover:bg-green-200';
        btnIcon = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>'; // Seta de voltar
    } else if (isAguardando) {
        cardClass = 'border-yellow-300 bg-yellow-50';
        statusBadge = '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded-full ml-2">AGUARDANDO RETIRADA</span>';
        nextStatus = 'FINALIZADO';
        btnClass = 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200';
        btnIcon = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>'; // Check final
    } else {
        cardClass = 'border-cyan-200 bg-white';
        statusBadge = '<span class="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-[10px] font-bold rounded-full ml-2">EM PRODUÇÃO</span>';
        nextStatus = 'AGUARDANDO RETIRADA';
        btnClass = 'bg-gray-100 text-gray-400 hover:bg-cyan-100 hover:text-cyan-600';
        btnIcon = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>'; // Seta de avanço
    }
        
    return `
        <div class="border ${cardClass} p-4 rounded-xl shadow-sm relative overflow-hidden transition-all duration-300">
            <div class="flex justify-between items-start mb-2 pr-10">
                <div class="font-bold text-gray-800 text-sm break-all">${item.descricao} ${statusBadge}</div>
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                <div>
                    <span class="font-semibold text-gray-400 block text-[10px] uppercase">Código</span>
                    <span>${item.codigo}</span>
                </div>
                <div>
                    <span class="font-semibold text-gray-400 block text-[10px] uppercase">Quantidade</span>
                    <span class="font-bold text-gray-900">${item.quantidadeTotal}</span>
                </div>
                <div class="col-span-2">
                    <span class="font-semibold text-gray-400 block text-[10px] uppercase">Cliente / Pedido</span>
                    <span class="truncate block">${item.empresa} - Pedido ${item.numeroPedido}</span>
                </div>
            </div>
            
            ${item.responsavel ? `<div class="mt-2 text-xs text-gray-500"><span class="font-semibold">Resp:</span> ${item.responsavel}</div>` : ''}

            <button onclick="window.handleMobileProductionStatus('${item.pedidoId}', '${item.codigo}', ${item.itemIndex}, '${item.numeroPedido}', '${nextStatus}', this)" class="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full ${btnClass} transition-colors shadow-sm z-10" title="Avançar Status">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${btnIcon}
                </svg>
            </button>
        </div>
    `;
}

producaoResponsavelFilter.addEventListener('change', renderProducaoView);

tabEmProducao.addEventListener('click', () => {
    currentProducaoTab = 'EM_PRODUCAO';
    tabEmProducao.className = "flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-md bg-white text-cyan-700 shadow-sm transition-all duration-200";
    tabAguardando.className = "flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-md text-gray-500 hover:text-gray-700 transition-all duration-200";
    tabFinalizados.className = "flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-md text-gray-500 hover:text-gray-700 transition-all duration-200";
    producaoListContainer.classList.remove('hidden');
    aguardandoListContainer.classList.add('hidden');
    finalizadosListContainer.classList.add('hidden');
});

tabAguardando.addEventListener('click', () => {
    currentProducaoTab = 'AGUARDANDO';
    tabAguardando.className = "flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-md bg-white text-yellow-700 shadow-sm transition-all duration-200";
    tabEmProducao.className = "flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-md text-gray-500 hover:text-gray-700 transition-all duration-200";
    tabFinalizados.className = "flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-md text-gray-500 hover:text-gray-700 transition-all duration-200";
    aguardandoListContainer.classList.remove('hidden');
    producaoListContainer.classList.add('hidden');
    finalizadosListContainer.classList.add('hidden');
});

tabFinalizados.addEventListener('click', () => {
    currentProducaoTab = 'FINALIZADOS';
    tabFinalizados.className = "flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-md bg-white text-green-700 shadow-sm transition-all duration-200";
    tabEmProducao.className = "flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-md text-gray-500 hover:text-gray-700 transition-all duration-200";
    tabAguardando.className = "flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-md text-gray-500 hover:text-gray-700 transition-all duration-200";
    finalizadosListContainer.classList.remove('hidden');
    producaoListContainer.classList.add('hidden');
    aguardandoListContainer.classList.add('hidden');
});

window.handleMobileProductionStatus = async function(pedidoId, itemCodigo, index, numeroPedido, novoStatus, btnElement) {
    
    const originalHtml = btnElement.innerHTML;
    btnElement.innerHTML = `<svg class="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    btnElement.disabled = true;

    try {
        const payload = {
            pedidoId: String(pedidoId),
            numeroPedido: String(numeroPedido),
            itemCodigo: String(itemCodigo),
            itemIndex: index,
            newStatus: novoStatus
        };

        const res = await fetch(API_URLS.UPDATE_ITEM_STATUS, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Falha na API.");

        const order = allPedidos.find(p => String(p.id) === String(pedidoId) || String(p.numero) === String(pedidoId));
        if (order) {
            if (!order.detalhesProducao) order.detalhesProducao = {};
            const key = `${pedidoId}-${index}`;
            if (!order.detalhesProducao[key]) order.detalhesProducao[key] = {};
            order.detalhesProducao[key].status = novoStatus;
        }

        renderProducaoView();
        
    } catch (e) {
        console.error(e);
        alert('Erro ao atualizar status.');
        btnElement.innerHTML = originalHtml;
        btnElement.disabled = false;
    }
}

// --- UTILS ---
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --- INITIALIZATION ---
function initializeApp() {
    initDB();
    
    // Navigation
    goToAdjustBtn.addEventListener('click', () => showView('adjust-view'));
    goToRequisitionBtn.addEventListener('click', () => showView('requisition-view'));
    goToEntradaBtn.addEventListener('click', () => showView('entrada-view'));
    goToPedidosBtn.addEventListener('click', () => showView('pedidos-view'));
    goToProducaoBtn.addEventListener('click', () => showView('producao-view'));
    adjustBackToMenuBtn.addEventListener('click', () => showView('menu-view'));
    entradaBackToMenuBtn.addEventListener('click', () => showView('menu-view'));
    pedidosBackToMenuBtn.addEventListener('click', () => showView('menu-view'));
    producaoBackToMenuBtn.addEventListener('click', () => showView('menu-view'));
    reqBackToMenuBtn.addEventListener('click', () => {
        if (requisitionItems.length === 0 || confirm("Deseja sair e limpar a lista de requisição atual?")) {
            requisitionItems = [];
            showView('menu-view');
        }
    });

    // Adjust View Listeners
    startScanBtn.addEventListener('click', startAdjustScan);
    stopScanBtn.addEventListener('click', stopAllScanners);
    saveBtn.addEventListener('click', saveStockAdjustment);
    cancelBtn.addEventListener('click', cancelAdjustAndRescan);
    accordionToggle.addEventListener('click', () => {
        accordionContent.classList.toggle('hidden');
        accordionIcon.classList.toggle('rotate-180');
    });

    // Requisition View Listeners
    reqStartScanBtn.addEventListener('click', startReqScan);
    reqStopScanBtn.addEventListener('click', stopAllScanners);
    requisitionListContainer.addEventListener('click', handleRequisitionListClick);
    launchFactoryBtn.addEventListener('click', () => launchRequisition('fabrica'));
    launchTerceirosBtn.addEventListener('click', () => launchRequisition('terceiros'));

    // Entrada View Listeners
    entradaStartScanBtn.addEventListener('click', startEntradaScan);
    entradaStopScanBtn.addEventListener('click', stopAllScanners);
    
    entradaManualBtn.addEventListener('click', () => {
        stopAllScanners();
        entradaFormContainer.classList.remove('hidden');
        entradaChaveAcesso.value = '';
        entradaDataEmissao.value = '';
        entradaNumeroNota.value = '';
        entradaFornecedor.value = '';
        entradaValorTotal.value = '';
        entradaObservacao.value = '';
        entradaChaveAcesso.focus();
    });

    entradaChaveAcesso.addEventListener('input', async (e) => {
        const value = e.target.value.replace(/\D/g, '');
        e.target.value = value;
        if (value.length === 44) {
            const dados = extrairDadosChave(value);
            if (dados) {
                entradaDataEmissao.value = dados.mesAno;
                entradaNumeroNota.value = dados.nNF;
                if (!entradaFornecedor.value) {
                    entradaFornecedor.placeholder = "Buscando fornecedor...";
                    const nome = await buscarFornecedor(dados.cnpj);
                    if (nome) entradaFornecedor.value = nome;
                    entradaFornecedor.placeholder = "Nome do fornecedor";
                }
            }
        } else {
            entradaDataEmissao.value = '';
        }
    });

    entradaSaveBtn.addEventListener('click', saveEntrada);
    entradaCancelBtn.addEventListener('click', () => {
        entradaFormContainer.classList.add('hidden');
        entradaChaveAcesso.value = '';
    });

    // Pedidos Search & Filter
    pedidosSearchInput.addEventListener('input', debounce(() => filterPedidos(), 300));
    pedidosStatusFilter.addEventListener('change', () => filterPedidos());

    // Pedidos Detalhes & Observation Modal
    closePedidosDetalhesModalBtn.addEventListener('click', () => pedidosDetalhesModal.classList.add('hidden'));
    openObsFromDetalhesBtn.addEventListener('click', () => {
        if (currentObsOrderId) {
            openOrderObservationModal(currentObsOrderId);
        }
    });

    closePedidosObsModalBtn.addEventListener('click', () => pedidosObsModal.classList.add('hidden'));
    savePedidosObsBtn.addEventListener('click', saveOrderObservation);
    pedidosObsTextarea.addEventListener('input', updateObservationCharCount);
    
    // Zoom Modal
    closeImageZoomBtn.addEventListener('click', () => imageZoomModal.classList.add('hidden'));

    showView('menu-view');
    
    // Inicializar Sync em tempo real globalmente logo no início
    initFirestoreSync();
}

initializeApp();
