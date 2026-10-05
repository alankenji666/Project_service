const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

const targetStr = "        if (_satgSearchInput) _satgSearchInput.addEventListener('input', _applySatgFilters);";
const newEvents = `        if (_satgSearchInput) _satgSearchInput.addEventListener('input', _applySatgFilters);
        if (_satgStatusSelect) _satgStatusSelect.addEventListener('change', _applySatgFilters);
        if (_satgSortRadios) {
            _satgSortRadios.forEach(radio => {
                radio.addEventListener('change', _applySatgFilters);
            });
        }`;

if(js.includes(targetStr)) {
    js = js.replace(targetStr, newEvents);
    fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
    console.log('Event listeners applied for new filter!');
} else {
    console.log('Target string not found');
}
