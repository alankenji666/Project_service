const fs = require('fs');

let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// Replace the loop
let parts = js.split('_filteredSatgData.forEach(req => {\n            const tr = document.createElement(\'tr\');');
if (parts.length === 1) {
    parts = js.split('_filteredSatgData.forEach(req => {\r\n            const tr = document.createElement(\'tr\');');
}

if(parts.length > 1) {
    const newCode = `        const wrapper = document.getElementById('satg-pagination-wrapper');
        if(wrapper) wrapper.classList.remove('hidden');

        const totalItems = _filteredSatgData.length;
        const totalPages = Math.ceil(totalItems / _satgPageSize) || 1;
        if (_satgCurrentPage > totalPages) _satgCurrentPage = totalPages;
        if (_satgCurrentPage < 1) _satgCurrentPage = 1;

        const startIndex = (_satgCurrentPage - 1) * _satgPageSize;
        const endIndex = Math.min(startIndex + _satgPageSize, totalItems);
        const pagedData = _filteredSatgData.slice(startIndex, endIndex);

        const info = document.getElementById('satg-pagination-info');
        if (info) info.innerHTML = \`Mostrando <span class="font-bold">\${startIndex + 1}</span> a <span class="font-bold">\${endIndex}</span> de <span class="font-bold">\${totalItems}</span> itens\`;

        const pageText = document.getElementById('satg-page-text');
        if (pageText) pageText.innerText = \`Página \${_satgCurrentPage} de \${totalPages}\`;

        const prevBtn = document.getElementById('satg-prev-btn');
        if (prevBtn) {
            prevBtn.disabled = _satgCurrentPage === 1;
            prevBtn.onclick = () => { _satgCurrentPage--; _renderSatgTable(); };
        }
        
        const nextBtn = document.getElementById('satg-next-btn');
        if (nextBtn) {
            nextBtn.disabled = _satgCurrentPage === totalPages;
            nextBtn.onclick = () => { _satgCurrentPage++; _renderSatgTable(); };
        }

        pagedData.forEach(req => {
            const tr = document.createElement('tr');`;
            
    js = parts.join(newCode);
    console.log('Successfully injected pagination logic into _renderSatgTable');
} else {
    console.log('Failed to find loop anchor');
}

// Replace the 0 case
let p2 = js.split(`        if (_filteredSatgData.length === 0) {
            _satgTableContent.parentElement.classList.add('hidden');
            if (_satgNoDataMessage) _satgNoDataMessage.classList.remove('hidden');
            return;
        }`);
if (p2.length === 1) {
    p2 = js.split(`        if (_filteredSatgData.length === 0) {\r\n            _satgTableContent.parentElement.classList.add('hidden');\r\n            if (_satgNoDataMessage) _satgNoDataMessage.classList.remove('hidden');\r\n            return;\r\n        }`);
}
if(p2.length > 1) {
    const newCode = `        if (_filteredSatgData.length === 0) {
            _satgTableContent.parentElement.classList.add('hidden');
            if (_satgNoDataMessage) _satgNoDataMessage.classList.remove('hidden');
            const wrapper = document.getElementById('satg-pagination-wrapper');
            if(wrapper) wrapper.classList.add('hidden');
            return;
        }`;
    js = p2.join(newCode);
}

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Done script replacement.');
