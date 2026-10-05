const fs = require('fs');

const htmlPath = 'index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

const oldFilterHtml = `                  <!-- BARRA DE FILTRO DE SAT-G -->
                  <div id="satg-top-filter-bar" class="bg-gray-50 p-4 border border-gray-200 rounded-lg shadow-sm mb-6 mt-2 hidden">
                      <div class="container mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                          <div>
                              <label for="satg-year-filter" class="block text-sm font-medium text-gray-700">Ano:</label>
                              <select id="satg-year-filter" class="mt-1 block w-24 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm">
                                  <option value="all">Tudo</option>
                              </select>
                          </div>
                          <div>
                              <label for="satg-start-date" class="block text-sm font-medium text-gray-700">Data Início:</label>
                              <input type="date" id="satg-start-date" class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm">
                          </div>
                          <div>
                              <label for="satg-end-date" class="block text-sm font-medium text-gray-700">Data Fim:</label>
                              <input type="date" id="satg-end-date" class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm">
                          </div>
                          <div>
                              <label for="satg-status-select" class="block text-sm font-medium text-gray-700">Situação:</label>
                              <select id="satg-status-select" class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm">
                                  <option value="all">Todas</option>
                                  <option value="em analise" selected>Em Análise</option>
                                  <option value="aprovado">Aprovado</option>
                                  <option value="recusado">Recusado / Arquivado</option>
                              </select>
                          </div>
                          <div class="flex flex-col gap-2 text-sm self-end">
                              <div class="flex items-center justify-start gap-x-4">
                                  <label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="satg-date-range" value="current_month" class="satg-date-radio text-purple-600 focus:ring-purple-500"> Mês Atual</label>
                                  <label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="satg-date-range" value="last_month" class="satg-date-radio text-purple-600 focus:ring-purple-500"> Último Mês</label>
                                  <label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="satg-date-range" value="last_3_months" class="satg-date-radio text-purple-600 focus:ring-purple-500"> Últimos 3 Meses</label>
                                  <label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="satg-date-range" value="last_6_months" class="satg-date-radio text-purple-600 focus:ring-purple-500"> Últimos 6 Meses</label>
                              </div>
                              <div class="flex items-center justify-start gap-x-4">
                                  <label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="satg-date-range" value="30" class="satg-date-radio text-purple-600 focus:ring-purple-500"> 30 dias</label>
                                  <label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="satg-date-range" value="60" class="satg-date-radio text-purple-600 focus:ring-purple-500"> 60 dias</label>
                                  <label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="satg-date-range" value="90" class="satg-date-radio text-purple-600 focus:ring-purple-500"> 90 dias</label>
                                  <label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="satg-date-range" value="all" class="satg-date-radio text-purple-600 focus:ring-purple-500" checked> Tudo</label>
                              </div>
                          </div>
                          <button id="satg-clear-filters-btn" class="self-end px-4 py-2 bg-gray-600 text-white rounded-lg shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors">Limpar</button>
                      </div>
                  </div>`;

const newFilterHtml = `                  <!-- BARRA DE FILTRO DE SAT-G -->
                  <div id="satg-top-filter-bar" class="bg-gray-50 p-4 border border-gray-200 rounded-lg shadow-sm mb-6 mt-2 hidden">
                      <div class="flex flex-wrap items-center gap-6">
                          <div>
                              <label for="satg-status-select" class="block text-sm font-medium text-gray-700 mb-1">Situação:</label>
                              <select id="satg-status-select" class="block w-48 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm">
                                  <option value="all">Todas</option>
                                  <option value="em analise" selected>Em Análise</option>
                                  <option value="aprovado">Aprovado</option>
                                  <option value="recusado">Recusado / Arquivado</option>
                              </select>
                          </div>
                          <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">Prioridade / Ordenação:</label>
                              <div class="flex items-center gap-4 bg-white px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                                  <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-medium hover:text-purple-700 transition-colors">
                                      <input type="radio" name="satg-sort-order" value="desc" class="satg-sort-radio text-purple-600 focus:ring-purple-500" checked>
                                      Mais Recentes (Novas)
                                  </label>
                                  <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-medium hover:text-purple-700 transition-colors">
                                      <input type="radio" name="satg-sort-order" value="asc" class="satg-sort-radio text-purple-600 focus:ring-purple-500">
                                      Mais Antigas (Urgentes)
                                  </label>
                              </div>
                          </div>
                      </div>
                  </div>`;

if(html.includes('<!-- BARRA DE FILTRO DE SAT-G -->')) {
    let parts = html.split(oldFilterHtml);
    if(parts.length > 1) {
        html = parts[0] + newFilterHtml + parts[1];
    } else {
        // Find using indexOf if exact match fails
        let start = html.indexOf('<!-- BARRA DE FILTRO DE SAT-G -->');
        let end = html.indexOf('<div id="garantia-satg-container"');
        if(start !== -1 && end !== -1) {
            html = html.substring(0, start) + newFilterHtml + '\n                  ' + html.substring(end);
        }
    }
}
fs.writeFileSync(htmlPath, html);
console.log('HTML index updated with new simple filter.');
