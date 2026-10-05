const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

js = js.replace('let _filteredSatgData = [];', 'let _filteredSatgData = [];\n    let _satgCurrentPage = 1;\n    const _satgPageSize = 20;');

// Now rewrite _renderSatgTable to include pagination logic
const renderTarget = `    function _renderSatgTable() {
        if (!_satgTableContent) return;
        _satgTableContent.innerHTML = '';

        if (_filteredSatgData.length === 0) {
            _satgTableContent.parentElement.classList.add('hidden');
            if (_satgNoDataMessage) _satgNoDataMessage.classList.remove('hidden');
            return;
        }

        _satgTableContent.parentElement.classList.remove('hidden');
        if (_satgNoDataMessage) _satgNoDataMessage.classList.add('hidden');

        _filteredSatgData.forEach(req => {
            const tr = document.createElement('tr');`;

const renderReplace = `    function _renderSatgTable() {
        if (!_satgTableContent) return;
        _satgTableContent.innerHTML = '';

        if (_filteredSatgData.length === 0) {
            _satgTableContent.parentElement.classList.add('hidden');
            if (_satgNoDataMessage) _satgNoDataMessage.classList.remove('hidden');
            const wrapper = document.getElementById('satg-pagination-wrapper');
            if(wrapper) wrapper.classList.add('hidden');
            return;
        }

        _satgTableContent.parentElement.classList.remove('hidden');
        if (_satgNoDataMessage) _satgNoDataMessage.classList.add('hidden');

        const wrapper = document.getElementById('satg-pagination-wrapper');
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

js = js.replace(renderTarget, renderReplace);

// We need to reset pagination on search
const searchTarget = `        _renderSatgTable();
    }`;

// let's just find `_filterSatgData() {` and replace the end of it
const filterTarget = `        });

        _renderSatgTable();
    }`;
const filterReplace = `        });

        _satgCurrentPage = 1;
        _renderSatgTable();
    }`;

js = js.replace(filterTarget, filterReplace);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('gerenciarGarantia.js updated with pagination');
