const fs = require('fs');

const filterBarHtml = `                  <!-- BARRA DE FILTRO DE SAT-G -->
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

let html = fs.readFileSync('index.html', 'utf8');

// The original filter was:
// <div id="garantia-satg-container" class="hidden bg-white rounded-2xl shadow-xl border border-gray-100 overflow-visible flex-col mb-8 relative min-h-[400px]">

let parts = html.split('<div id="garantia-satg-container"');
if (parts.length > 1) {
    html = parts[0] + filterBarHtml + '\n                  <div id="garantia-satg-container"' + parts[1];
    fs.writeFileSync('index.html', html);
    console.log('Top filter bar injected to HTML');
} else {
    console.log('Anchor for top filter bar not found!');
}
