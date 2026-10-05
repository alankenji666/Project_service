const fs = require('fs');
let js = fs.readFileSync('js/modulos/dashboard.js', 'utf8');

// Inject API references if missing (it usually comes from import)
// But we need to use fetch. We can assume API_URLS is available.

// 1. Inject DOM references
const domRefRegex = /_dom\.selectRankingBtn = document\.getElementById\('select-ranking-dashboard'\);/;
const domRefRepl = `_dom.selectRankingBtn = document.getElementById('select-ranking-dashboard');
        _dom.selectGarantiaBtn = document.getElementById('select-garantia-dashboard');
        _dom.garantiaContainer = document.getElementById('dashboard-garantia-container');
        _dom.backToSelectorFromGarantiaBtn = document.getElementById('back-to-selector-from-garantia-btn');`;
js = js.replace(domRefRegex, domRefRepl);

// 2. Hide/show logic inside _showSelector
const showSelRegex = /if \(_dom\.selectRankingBtn\) _dom\.selectRankingBtn\.classList\.toggle\('hidden', !showRanking\);/;
const showSelRepl = `if (_dom.selectRankingBtn) _dom.selectRankingBtn.classList.toggle('hidden', !showRanking);
                if (_dom.selectGarantiaBtn) _dom.selectGarantiaBtn.classList.remove('hidden'); // Sempre visivel para quem tem acesso a dashboard`;
js = js.replace(showSelRegex, showSelRepl);

// 3. Add to event listeners
const eventRegex = /_dom\.backToSelectorFromRankingBtn\?\.addEventListener\('click', _showSelector\);/;
const eventRepl = `_dom.backToSelectorFromRankingBtn?.addEventListener('click', _showSelector);
        _dom.selectGarantiaBtn?.addEventListener('click', _showGarantiaDashboard);
        _dom.backToSelectorFromGarantiaBtn?.addEventListener('click', _showSelector);`;
js = js.replace(eventRegex, eventRepl);

// 4. Hide it when showing others
const showSalesRegex = /_dom\.vendasContainer\?\.classList\.remove\('hidden'\);/;
const showSalesRepl = `_dom.garantiaContainer?.classList.add('hidden');
        _dom.vendasContainer?.classList.remove('hidden');`;
js = js.replace(showSalesRegex, showSalesRepl);

const showEstoqueRegex = /_dom\.estoqueContainer\?\.classList\.remove\('hidden'\);/;
const showEstoqueRepl = `_dom.garantiaContainer?.classList.add('hidden');
        _dom.estoqueContainer?.classList.remove('hidden');`;
js = js.replace(showEstoqueRegex, showEstoqueRepl);

const showRankingRegex = /_dom\.rankingContainer\?\.classList\.remove\('hidden'\);/;
const showRankingRepl = `_dom.garantiaContainer?.classList.add('hidden');
        _dom.rankingContainer?.classList.remove('hidden');`;
js = js.replace(showRankingRegex, showRankingRepl);

// 5. Build _showGarantiaDashboard function
const funcCode = `
    async function _showGarantiaDashboard() {
        _dom.selectorContainer?.classList.add('hidden');
        _dom.vendasContainer?.classList.add('hidden');
        _dom.estoqueContainer?.classList.add('hidden');
        _dom.rankingContainer?.classList.add('hidden');
        if (_dom.garantiaContainer) _dom.garantiaContainer.classList.remove('hidden');

        const summaryContainer = document.getElementById('garantia-summary-cards');
        if (!summaryContainer) return;
        
        summaryContainer.innerHTML = '<div class="col-span-4 text-center py-8 text-gray-500"><svg class="animate-spin h-8 w-8 mx-auto mb-2 text-purple-500" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Carregando dados da garantia...</div>';

        try {
            // Fetch dataparallel
            const [satgRes, pedidoRes] = await Promise.all([
                fetch(API_URLS.GARANTIA_SATG),
                fetch(API_URLS.GARANTIA_PEDIDO)
            ]);

            const satgData = await satgRes.json();
            const pedRespData = await pedidoRes.json();
            const pedidoData = Array.isArray(pedRespData) ? pedRespData : (pedRespData.data || []);

            let qtdAprovadas = 0;
            let qtdRecusadas = 0;
            let gastoFrete = 0;
            let gastoPecas = 0;
            
            const countEquipamentos = {};
            const countClientes = {};
            const countPecas = {};

            // Analisar SAT-Gs
            satgData.forEach(satg => {
                const status = String(satg.status || '').toUpperCase();
                if (status.includes('APROVADO')) qtdAprovadas++;
                if (status.includes('RECUSADO')) qtdRecusadas++;

                const equip = (satg.equipamento || satg.produto || 'Não informado').trim();
                const cliente = (satg.cliente || 'Não informado').trim();

                countEquipamentos[equip] = (countEquipamentos[equip] || 0) + 1;
                countClientes[cliente] = (countClientes[cliente] || 0) + 1;
            });

            // Parse Pedidos (Custos e Peças)
            pedidoData.forEach(ped => {
                // Frete
                if (ped.valorFrete) {
                    let fStr = String(ped.valorFrete).replace(/\\./g, '').replace(',', '.').replace(/[^\\d.-]/g, '');
                    gastoFrete += (parseFloat(fStr) || 0);
                }

                // Peças
                if (ped.itens && ped.itens.trim() !== '') {
                    const regex = /\\(([^)]+)\\)/g;
                    let match;
                    while ((match = regex.exec(ped.itens)) !== null) {
                        const partes = match[1].split(',');
                        if (partes.length >= 3) {
                            const codDesc = partes[0].trim();
                            const qtd = parseFloat(partes[1]) || 0;
                            const precoRaw = partes[2].split('|')[0];
                            const preco = parseFloat(precoRaw) || 0;
                            const custoItem = qtd * preco;
                            
                            gastoPecas += custoItem;

                            if (!countPecas[codDesc]) countPecas[codDesc] = { qtd: 0, custo: 0 };
                            countPecas[codDesc].qtd += qtd;
                            countPecas[codDesc].custo += custoItem;
                        }
                    }
                }
            });

            const fmtBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

            // Renderizar Cards de Resumo
            summaryContainer.innerHTML = \`
                <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-sm font-bold text-gray-500 uppercase tracking-wide">Garantias Aprovadas</p>
                            <h3 class="text-3xl font-black text-gray-800 mt-1">\${qtdAprovadas}</h3>
                        </div>
                        <div class="p-3 bg-green-50 rounded-xl"><svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>
                    </div>
                    <div class="text-sm text-gray-500 mt-2">VS <span class="text-red-500 font-bold">\${qtdRecusadas}</span> Recusadas</div>
                </div>

                <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-sm font-bold text-gray-500 uppercase tracking-wide">Custo com Peças</p>
                            <h3 class="text-2xl font-black text-gray-800 mt-1">\${fmtBRL(gastoPecas)}</h3>
                        </div>
                        <div class="p-3 bg-blue-50 rounded-xl"><svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></div>
                    </div>
                </div>

                <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-sm font-bold text-gray-500 uppercase tracking-wide">Custo com Frete</p>
                            <h3 class="text-2xl font-black text-gray-800 mt-1">\${fmtBRL(gastoFrete)}</h3>
                        </div>
                        <div class="p-3 bg-orange-50 rounded-xl"><svg class="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path></svg></div>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 shadow-lg text-white flex flex-col justify-between">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-sm font-bold text-purple-200 uppercase tracking-wide">Custo Total (Peças + Frete)</p>
                            <h3 class="text-3xl font-black mt-1">\${fmtBRL(gastoPecas + gastoFrete)}</h3>
                        </div>
                        <div class="p-3 bg-white/20 rounded-xl"><svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                    </div>
                </div>
            \`;

            // Sort Equipamentos
            const topEquips = Object.entries(countEquipamentos).sort((a, b) => b[1] - a[1]).slice(0, 10);
            const equipList = document.getElementById('garantia-equipamentos-list');
            if (equipList) {
                equipList.innerHTML = topEquips.map(([name, count]) => \`
                    <li class="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <span class="font-medium text-gray-700 text-sm truncate pr-4">\${name}</span>
                        <span class="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full">\${count} SAT-Gs</span>
                    </li>
                \`).join('');
            }

            // Sort Clientes
            const topClientes = Object.entries(countClientes).sort((a, b) => b[1] - a[1]).slice(0, 10);
            const cliList = document.getElementById('garantia-clientes-list');
            if (cliList) {
                cliList.innerHTML = topClientes.map(([name, count]) => \`
                    <li class="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <span class="font-medium text-gray-700 text-sm truncate pr-4">\${name}</span>
                        <span class="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">\${count} SAT-Gs</span>
                    </li>
                \`).join('');
            }

            // Sort Peças Usadas (by quantity desc)
            const topPecas = Object.entries(countPecas).sort((a, b) => b[1].qtd - a[1].qtd);
            const pecasList = document.getElementById('garantia-pecas-list');
            if (pecasList) {
                pecasList.innerHTML = topPecas.map(([name, data]) => \`
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-4 py-3 text-gray-800 font-medium truncate max-w-[200px]" title="\${name}">\${name}</td>
                        <td class="px-4 py-3 text-center"><span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">\${data.qtd} un</span></td>
                        <td class="px-4 py-3 text-right font-bold text-gray-700">\${fmtBRL(data.custo)}</td>
                    </tr>
                \`).join('');
            }

        } catch (err) {
            console.error('Erro ao carregar dashboard de garantia:', err);
            summaryContainer.innerHTML = '<div class="col-span-4 text-center py-8 text-red-500">Erro ao carregar dados. Tente novamente mais tarde.</div>';
        }
    }
`;

js += '\n' + funcCode;

fs.writeFileSync('js/modulos/dashboard.js', js);
console.log('Script do Dashboard de Garantia injetado!');
