const fs = require('fs');
let js = fs.readFileSync('js/main.js', 'utf8');

// The payload block
const regexPayload = /const linhaPayload = \{\s*pedidoId: orderCode,\s*itemCodigo: codigoService,\s*newStatus: 'Em Produção',\s*itemIndex: 1,\s*newDescription: '',\s*responsavel: ans,\s*numeroPedido: orderCode,\s*quantidade: event\.target\.dataset\.quantidade \|\| 1\s*\};/;

const newPayloadBlock = `
                                        const targetItemDesc = _allOrdersFabrica.flatMap(o => o.rawItems).find(i => i.orderCode === orderCode && i.codigoService === codigoService);
                                        const dt = new Date();
                                        const dtStr = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
                                        
                                        const linhaPayload = {
                                            pedidoId: orderCode,
                                            itemCodigo: codigoService,
                                            newStatus: 'Em Produção',
                                            itemIndex: 1,
                                            newDescription: targetItemDesc ? targetItemDesc.descricao : '',
                                            responsavel: ans,
                                            numeroPedido: orderCode,
                                            quantidade: event.target.dataset.quantidade || 1,
                                            dataPedido: dtStr
                                        };`;

js = js.replace(regexPayload, newPayloadBlock);

fs.writeFileSync('js/main.js', js);
console.log('Payload da LinhaProducao atualizado com descricao e data');
