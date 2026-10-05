const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarPedidos.js', 'utf8');

const regex = /let s = String\(status \|\| 'OK'\)[\s\S]*?const statusOptions = \['OK', 'EM PRODUÇÃO', 'FINALIZADO'\];[\s\S]*?let dropdownOptions = statusOptions\.map\(opt => \{[\s\S]*?return \`<button/;

const replacement = `let s = String(status || 'OK').toUpperCase().trim();
        if (s === 'CRIADO' || s === 'PENDENTE' || s === 'FINALIZADO') s = 'OK';
        let currentStatus = s;
        if (currentStatus === 'PRODUCAO' || currentStatus === 'EM PRODUCAO') currentStatus = 'EM PRODUÇÃO';
        
        if (!window._pedidoItemDropdownListener) {
            document.addEventListener('click', () => {
                document.querySelectorAll('.pedido-item-custom-dropdown-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
            });
            window._pedidoItemDropdownListener = true;
        }
        
        const statusOptions = ['OK', 'EM PRODUÇÃO'];
        if (!statusOptions.includes(currentStatus)) {
            currentStatus = 'OK'; // Default fallback
        }

        let pBadgeClass = 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'; // OK default
        if (currentStatus === 'EM PRODUÇÃO') pBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';

        let dropdownOptions = statusOptions.map(opt => {
            let dotColor = 'bg-green-400';
            if (opt === 'EM PRODUÇÃO') dotColor = 'bg-blue-400';
            return \`<button`;

js = js.replace(regex, replacement);

fs.writeFileSync('js/modulos/gerenciarPedidos.js', js);
console.log('Script modificado removendo FINALIZADO e deixando OK verde');
