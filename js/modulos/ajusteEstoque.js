export function init(config = {}) {
    const btnOpen = document.getElementById('adjust-stock-menu-btn');
    if (!btnOpen) return;

    // Create the modal container dynamically
    const modal = document.createElement('div');
    modal.id = 'adjust-stock-modal';
    modal.className = 'fixed hidden inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[200] p-4 backdrop-blur-sm';
    
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg transform transition-all flex flex-col">
            <!-- Header -->
            <div class="flex justify-between items-center p-5 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                <div>
                    <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        Ajustar Estoque
                    </h2>
                    <p class="text-xs text-gray-500 mt-1">Ferramentas avançadas para correção de saldo no Bling.</p>
                </div>
                <button id="close-adjust-stock-btn" class="text-gray-400 hover:text-gray-600 focus:outline-none rounded-full p-1 hover:bg-gray-200">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <!-- Body -->
            <div class="p-6 flex flex-col gap-4">
                <button id="btn-zero-negative" class="flex items-center gap-4 p-4 border border-red-200 bg-red-50 hover:bg-red-100 rounded-xl transition-colors w-full text-left group">
                    <div class="p-3 bg-red-100 text-red-600 rounded-lg group-hover:bg-red-200 transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-red-800">Zerar Estoque Negativo</h3>
                        <p class="text-xs text-red-600 mt-1">Busca todos os produtos com saldo abaixo de zero e cria um balanço para zerá-los.</p>
                    </div>
                </button>

                <button id="btn-zero-all" class="flex items-center gap-4 p-4 border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 rounded-xl transition-colors w-full text-left group">
                    <div class="p-3 bg-yellow-100 text-yellow-600 rounded-lg group-hover:bg-yellow-200 transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-yellow-800">Zerar Todo Estoque</h3>
                        <p class="text-xs text-yellow-600 mt-1">Atenção! Zera o saldo de TODOS os produtos cadastrados na plataforma.</p>
                    </div>
                </button>
            </div>
            
            <div class="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end">
                 <button id="cancel-adjust-stock-btn" class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancelar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const btnClose = modal.querySelector('#close-adjust-stock-btn');
    const btnCancel = modal.querySelector('#cancel-adjust-stock-btn');
    const btnZeroNegative = modal.querySelector('#btn-zero-negative');
    const btnZeroAll = modal.querySelector('#btn-zero-all');

    const closeModal = () => modal.classList.add('hidden');
    
    btnOpen.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('hidden');
        // Hide the settings dropdown when modal opens
        const dropdown = document.getElementById('settings-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    });

    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    btnZeroNegative.addEventListener('click', () => {
        const negativeProducts = config.allProducts.filter(p => Number(p.estoque) < 0);
        if (negativeProducts.length === 0) {
            config.utils.showMessageModal("Tudo certo", "Não existem produtos com estoque negativo no momento.");
            return;
        }
        if (confirm(`Tem certeza que deseja zerar o estoque de ${negativeProducts.length} produtos negativos? Isso pode demorar alguns minutos.`)) {
            processZeroing(negativeProducts, "Zerar Estoque Negativo");
        }
    });

    btnZeroAll.addEventListener('click', () => {
        if (confirm(`ATENÇÃO! Tem certeza absoluta que deseja ZERAR O ESTOQUE DE TODOS OS ${config.allProducts.length} PRODUTOS?`)) {
            if (confirm("Esta ação é IRREVERSÍVEL. Clique em OK para confirmar novamente.")) {
                processZeroing(config.allProducts, "Zerar Todo Estoque");
            }
        }
    });

    async function processZeroing(productsToZero, operationName) {
        // Mudar o conteúdo do modal para mostrar progresso
        const bodyContainer = modal.querySelector('.p-6.flex.flex-col.gap-4');
        bodyContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center p-6 text-center">
                <div class="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <h3 class="text-lg font-bold text-gray-800 mb-2">Processando ${operationName}...</h3>
                <p class="text-sm text-gray-500 mb-4">Por favor, não feche esta janela.</p>
                
                <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
                    <div id="zero-progress-bar" class="bg-blue-600 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
                </div>
                <p id="zero-progress-text" class="text-sm font-semibold text-gray-700">0 de ${productsToZero.length}</p>
            </div>
        `;
        
        btnCancel.disabled = true;
        btnClose.disabled = true;

        let successCount = 0;
        let errorCount = 0;

        const progressBar = modal.querySelector('#zero-progress-bar');
        const progressText = modal.querySelector('#zero-progress-text');

        for (let i = 0; i < productsToZero.length; i++) {
            const product = productsToZero[i];
            
            try {
                const response = await fetch(config.apiUrls.ORDERS_UPDATE, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        produto: { id: product.id, codigo: product.codigo },
                        operacaoBling: 'B',
                        quantidadeFinal: 0,
                        tipoEntrada: "AJUSTE_ZERAMENTO",
                        observacoes: operationName
                    })
                });

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (e) {
                console.error(e);
                errorCount++;
            }

            // Atualizar UI
            const percentage = Math.round(((i + 1) / productsToZero.length) * 100);
            progressBar.style.width = percentage + '%';
            progressText.innerText = `${i + 1} de ${productsToZero.length} (${percentage}%)`;
        }

        // Fim
        bodyContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center p-6 text-center">
                <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 class="text-lg font-bold text-gray-800 mb-2">Operação Concluída</h3>
                <p class="text-sm text-gray-600 mb-2"><strong>${successCount}</strong> produtos zerados com sucesso.</p>
                ${errorCount > 0 ? `<p class="text-sm text-red-600">Falha em ${errorCount} produtos.</p>` : ''}
                <p class="text-xs text-gray-500 mt-4">A página será recarregada para atualizar os dados.</p>
            </div>
        `;
        
        btnCancel.innerText = "Fechar";
        btnCancel.disabled = false;
        btnClose.disabled = false;

        btnCancel.addEventListener('click', () => {
            if (config.utils && config.utils.fetchData) {
                config.utils.fetchData();
            } else {
                window.location.reload();
            }
        });
    }
}
