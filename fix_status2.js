const fs = require('fs');
let js = fs.readFileSync('js/main.js', 'utf8');

const statusBlockRegex = /if \(itemStatus === 'ok'\) \{\s*statusHtml = _createOrderStatusPill\('ok', 'OK'\);\s*rowClass = 'row-ok';\s*\} else \{ \/\/ Para 'PENDENTE' ou qualquer outro status não-OK\s*if \(diasAtrasadosUteis > 0\) \{\s*statusHtml = _createOrderStatusPill\('overdue', statusText\);\s*rowClass = 'row-overdue';\s*\} else \{\s*statusHtml = _createOrderStatusPill\('pending', statusText\);\s*rowClass = 'row-pending';\s*\}\s*\}/;

const newStatusBlock = `if (item.requisitionType === 'fabrica') {
                            if (isOk) {
                                statusHtml = _createOrderStatusPill('ok', statusText);
                                rowClass = 'row-ok';
                            } else {
                                statusHtml = \`<select data-quantidade="\${item.quantidadePedido}" class="fabrica-status-select text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-yellow-50 text-yellow-800" data-order-code="\${item.orderCode}" data-codigo-service="\${item.codigoService}">
                                    <option value="Criado" \${itemStatus === 'criado' || itemStatus === 'pendente' ? 'selected' : ''}>Criado</option>
                                    <option value="Em Produção" \${itemStatus === 'em produção' || itemStatus === 'em producao' ? 'selected' : ''}>Em Produção</option>
                                    <option value="Finalizado">Finalizado</option>
                                </select>\`;
                                rowClass = diasAtrasadosUteis > 0 ? 'row-overdue' : 'row-pending';
                            }
                        } else {
                            if (itemStatus === 'ok') {
                                statusHtml = _createOrderStatusPill('ok', 'OK');
                                rowClass = 'row-ok';
                            } else {
                                if (diasAtrasadosUteis > 0) {
                                    statusHtml = _createOrderStatusPill('overdue', statusText);
                                    rowClass = 'row-overdue';
                                } else {
                                    statusHtml = _createOrderStatusPill('pending', statusText);
                                    rowClass = 'row-pending';
                                }
                            }
                        }`;

js = js.replace(statusBlockRegex, newStatusBlock);

fs.writeFileSync('js/main.js', js);
console.log('Fixed regex fail');
