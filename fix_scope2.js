const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// The block to remove:
const toRemove = `            // Buscar com mais flexibilidade (com ou sem GAR-)
            const cleanRef = refStr.replace('GAR-', '');
            const satgAssociado = _satgData.find(s => {
                const sId = String(s.idPedido || '').replace('GAR-', '');
                return sId === cleanRef && sId !== '';
            });`;

// The block to insert at the top:
const toInsert = `        const refStr = String(idPedido);
        const cleanRef = refStr.replace('GAR-', '');
        const satgAssociado = _satgData.find(s => {
            const sId = String(s.idPedido || '').replace('GAR-', '');
            return sId === cleanRef && sId !== '';
        });`;

js = js.replace(toRemove, '            // Buscar com mais flexibilidade (com ou sem GAR-)');
js = js.replace('const refStr = String(idPedido);', toInsert);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('cleanRef fixed correctly!');
