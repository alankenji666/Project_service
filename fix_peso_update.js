const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /if \(\!updateSuccess\) throw lastError;/;
const replacement = `if (!updateSuccess) throw lastError;
                            
                            // Atualiza o item local no array atual do pedido de garantia
                            item.peso = currentPeso;
                            item.pesoBruto = currentPeso;
                            // Recalcula o peso total para atualizar o campo "Peso Total (kg)" na UI
                            _updateUIPesoTotal();`;

js = js.replace(regex, replacement);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Script ajustado para atualizar o peso total imediatamente após sync!');
