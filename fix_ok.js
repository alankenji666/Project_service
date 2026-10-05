const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarPedidos.js', 'utf8');

const regex = /function _createItemStatusBadge\(status, pedidoId, itemCodigo, index\) \{[\s\S]*?return \`[\s\S]*?<\/button>\s*<\/div>\s*<\/div>\`;\s*\}/;

const newCreateBadge = `function _createItemStatusBadge(status, pedidoId, itemCodigo, index) {
        let s = String(status || 'OK').toUpperCase().trim();
        if (s === 'CRIADO' || s === 'PENDENTE') s = 'OK';
        let currentStatus = s;
        if (currentStatus === 'PRODUCAO' || currentStatus === 'EM PRODUCAO') currentStatus = 'EM PRODUÇÃO';
        
        if (!window._pedidoItemDropdownListener) {
            document.addEventListener('click', () => {
                document.querySelectorAll('.pedido-item-custom-dropdown-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
            });
            window._pedidoItemDropdownListener = true;
        }
        
        const statusOptions = ['OK', 'EM PRODUÇÃO', 'FINALIZADO'];
        if (!statusOptions.includes(currentStatus)) {
            currentStatus = 'OK'; // Default fallback
        }

        let pBadgeClass = 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'; // OK default
        if (currentStatus === 'EM PRODUÇÃO') pBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
        if (currentStatus === 'FINALIZADO') pBadgeClass = 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';

        let dropdownOptions = statusOptions.map(opt => {
            let dotColor = 'bg-gray-400';
            if (opt === 'EM PRODUÇÃO') dotColor = 'bg-blue-400';
            if (opt === 'FINALIZADO') dotColor = 'bg-green-400';
            
            // Map the passed status for the payload correctly.
            // When updating to OK, we can pass OK.
            return \`<button type="button" onclick="GerenciarPedidosApp.handleDropdownItemStatus('\${pedidoId}', '\${itemCodigo}', '\${opt}', \${index}, '\${currentStatus}', event)" class="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 pedido-item-dropdown-option"><span class="w-2 h-2 rounded-full \${dotColor}"></span>\${opt}</button>\`;
        }).join('');

        return \`
        <div class="relative inline-block text-left" data-dropdown-container>
            <button type="button" onclick="event.stopPropagation(); document.querySelectorAll('.pedido-item-custom-dropdown-menu:not(.hidden)').forEach(m => { if(m !== this.nextElementSibling) m.classList.add('hidden') }); this.nextElementSibling.classList.toggle('hidden');" class="px-3 py-1 inline-flex items-center justify-between text-[11px] font-bold rounded-full border \${pBadgeClass} min-w-[120px] transition-all cursor-pointer shadow-sm">
                <span class="flex-1 text-center">\${currentStatus}</span>
                <svg class="w-3 h-3 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div class="pedido-item-custom-dropdown-menu absolute right-0 mt-1.5 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-[60] hidden overflow-hidden py-1">
                \${dropdownOptions}
            </div>
        </div>\`;
    }`;

js = js.replace(regex, newCreateBadge);

// Ensure the backend sends 'OK' if the user selects 'OK'.
// In handleDropdownItemStatus, we had: newStatus: newStatus === 'FINALIZADO' ? 'OK' : newStatus
// But now FINALIZADO is a distinct state, and OK is a distinct state.
// So we just send newStatus directly!

const payloadRegex = /newStatus: newStatus === 'FINALIZADO' \? 'OK' : newStatus/g;
js = js.replace(payloadRegex, "newStatus: newStatus");

const cacheRegex = /status: newStatus === 'FINALIZADO' \? 'OK' : newStatus/g;
js = js.replace(cacheRegex, "status: newStatus");

fs.writeFileSync('js/modulos/gerenciarPedidos.js', js);
console.log('Script modificado com OK em vez de CRIADO');
