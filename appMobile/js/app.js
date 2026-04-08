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

// App State
let allProducts = [];
let adjustSelectedProduct = null;
let requisitionItems = [];
let adjustScanner, reqScanner, entradaScanner;
let db;
const DB_NAME = 'ajuste-estoque-db';
const STORE_NAME = 'pending-adjustments';

// --- Navigation & View Management ---
function showView(viewId) {
    menuView.classList.add('hidden');
    adjustView.classList.add('hidden');
    requisitionView.classList.add('hidden');
    entradaView.classList.add('hidden');
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

// --- INITIALIZATION ---
function initializeApp() {
    initDB();
    
    // Navigation
    goToAdjustBtn.addEventListener('click', () => showView('adjust-view'));
    goToRequisitionBtn.addEventListener('click', () => showView('requisition-view'));
    goToEntradaBtn.addEventListener('click', () => showView('entrada-view'));
    adjustBackToMenuBtn.addEventListener('click', () => showView('menu-view'));
    entradaBackToMenuBtn.addEventListener('click', () => showView('menu-view'));
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

    showView('menu-view');
}

initializeApp();
