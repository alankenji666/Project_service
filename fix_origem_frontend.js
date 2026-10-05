const fs = require('fs');
let js = fs.readFileSync('js/main.js', 'utf8');

const regexPayload = /quantidade: event\.target\.dataset\.quantidade \|\| 1,\s*dataPedido: dtStr\s*\};/;

const newPayloadBlock = `quantidade: event.target.dataset.quantidade || 1,
                                            dataPedido: dtStr,
                                            origem: 'Reposição'
                                        };`;

js = js.replace(regexPayload, newPayloadBlock);

fs.writeFileSync('js/main.js', js);
console.log('Payload da LinhaProducao atualizado com origem');
