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

// App State
let allProducts = [];
let adjustSelectedProduct = null;
let requisitionItems = [];
let adjustScanner, reqScanner;
let db;
const DB_NAME = 'ajuste-estoque-db';
const STORE_NAME = 'pending-adjustments';

// --- Navigation & View Management ---
function showView(viewId) {
    menuView.classList.add('hidden');
    adjustView.classList.add('hidden');
    requisitionView.classList.add('hidden');
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
    }
}

function stopAllScanners() {
    if (adjustScanner && adjustScanner.isScanning) adjustScanner.stop().catch(console.error);
    if (reqScanner && reqScanner.isScanning) reqScanner.stop().catch(console.error);
    scannerContainer.classList.add('hidden');
    stopScanBtn.classList.add('hidden');
    startScanBtn.classList.remove('hidden');
    reqScannerContainer.classList.add('hidden');
    reqStopScanBtn.classList.add('hidden');
    reqStartScanBtn.classList.remove('hidden');
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

// --- INITIALIZATION ---
function initializeApp() {
    initDB();
    
    // Navigation
    goToAdjustBtn.addEventListener('click', () => showView('adjust-view'));
    goToRequisitionBtn.addEventListener('click', () => showView('requisition-view'));
    adjustBackToMenuBtn.addEventListener('click', () => showView('menu-view'));
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

    showView('menu-view');
}

initializeApp();
