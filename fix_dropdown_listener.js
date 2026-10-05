const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarPedidos.js', 'utf8');

js = js.replace(/const statusOptions = \['CRIADO', 'EM PRODUÇÃO', 'FINALIZADO'\];/, 
`if (!window._pedidoItemDropdownListener) {
            document.addEventListener('click', () => {
                document.querySelectorAll('.pedido-item-custom-dropdown-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
            });
            window._pedidoItemDropdownListener = true;
        }
        const statusOptions = ['CRIADO', 'EM PRODUÇÃO', 'FINALIZADO'];`);

fs.writeFileSync('js/modulos/gerenciarPedidos.js', js);
console.log('Listener adicionado!');
