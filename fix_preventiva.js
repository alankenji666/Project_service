const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const regex = /injectEditPencil\('satg-modal-preventiva', 'T', 'dataUltimaPreventiva', req\.dataUltimaPreventiva\);/;
if (js.match(regex)) {
    js = js.replace(regex, "injectEditPencil('satg-modal-preventiva', 'T', 'dataUltimaPreventiva', req.dataUltimaPreventiva, 'data');");
    fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
    console.log('Fixed preventiva mask!');
} else {
    console.log('Regex did not match!');
}
