const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Regex to match the two options: "Imprimir Lista" and "Imprimir Requisição"
// Usually they are in the `report-actions-dropdown`.
const regex = /<a href="#" id="report-action-print-list".*?<\/a>\s*<a href="#" id="report-action-print-req".*?<\/a>/s;

if (html.match(regex)) {
    html = html.replace(regex, '');
    fs.writeFileSync('index.html', html);
    console.log('Removido as opções de impressão do relatório (Preparar Requisição)!');
} else {
    console.log('Regex HTML falhou. Verifique.');
}
