const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const newFilterBar = `                    <div id="satg-top-filter-bar" class="bg-gray-50 p-4 border border-gray-200 rounded-lg shadow-sm mb-6 mt-2 hidden">
                        <div class="flex flex-wrap items-center gap-4">
                            <!-- Situação Garantia -->
                            <div>
                                <label for="satg-status-select" class="block text-sm font-medium text-gray-700 mb-1">Garantia:</label>
                                <select id="satg-status-select" class="block w-40 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm">
                                    <option value="all">Todas</option>
                                    <option value="em analise" selected>Em Análise</option>
                                    <option value="aprovado">Aprovado</option>
                                    <option value="recusado">Recusado</option>
                                </select>
                            </div>
                            <!-- Situação Orçamento -->
                            <div>
                                <label for="satg-orcamento-select" class="block text-sm font-medium text-gray-700 mb-1">Orçamento:</label>
                                <select id="satg-orcamento-select" class="block w-40 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                                    <option value="all" selected>Todas</option>
                                    <option value="em analise">Em Análise</option>
                                    <option value="em andamento">Em Andamento</option>
                                    <option value="aguardando peça">Aguardando Peça</option>
                                    <option value="pronto para envio">Pronto p/ Envio</option>
                                    <option value="enviado">Enviado</option>
                                    <option value="finalizado">Finalizado</option>
                                    <option value="cancelado">Cancelado</option>
                                </select>
                            </div>
                            <!-- Situação Retorno -->
                            <div>
                                <label for="satg-retorno-select" class="block text-sm font-medium text-gray-700 mb-1">Retorno Item:</label>
                                <select id="satg-retorno-select" class="block w-40 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                                    <option value="all" selected>Todas</option>
                                    <option value="em analise">Em Análise</option>
                                    <option value="solicitado">Solicitado</option>
                                    <option value="finalizado">Finalizado</option>
                                    <option value="não retornado">Não Retornado</option>
                                    <option value="cancelado">Cancelado</option>
                                </select>
                            </div>
                            <!-- Ordenação -->
                            <div class="ml-auto">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Prioridade / Ordenação:</label>
                                <div class="flex items-center gap-4 bg-white px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                                    <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-medium hover:text-purple-700 transition-colors">
                                        <input type="radio" name="satg-sort-order" value="desc" class="satg-sort-radio text-purple-600 focus:ring-purple-500" checked>
                                        Novas
                                    </label>
                                    <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-medium hover:text-purple-700 transition-colors">
                                        <input type="radio" name="satg-sort-order" value="asc" class="satg-sort-radio text-purple-600 focus:ring-purple-500">
                                        Urgentes
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>`;

let startIdx = html.indexOf('<div id="satg-top-filter-bar"');
let endIdx = html.indexOf('<div id="garantia-satg-container"');

if(startIdx !== -1 && endIdx !== -1) {
    html = html.substring(0, startIdx) + newFilterBar + '\n                    ' + html.substring(endIdx);
    fs.writeFileSync('index.html', html);
    console.log('HTML filter bar updated with 3 dropdowns.');
} else {
    console.log('Error finding filter bar bounds.');
}
