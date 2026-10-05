const fs = require('fs');

let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// The new variable declarations
const newVars = `    let _satgTopFilterBar;
    let _satgStatusSelect;
    let _satgSortRadios;`;

let oldVarsRegex = /let _satgTopFilterBar;[\s\S]*?let _satgClearFiltersBtn;/;
js = js.replace(oldVarsRegex, newVars);

const newDomInit = `        _satgTopFilterBar = document.getElementById('satg-top-filter-bar');
        _satgStatusSelect = document.getElementById('satg-status-select');
        _satgSortRadios = document.querySelectorAll('.satg-sort-radio');`;

let oldDomRegex = /_satgTopFilterBar = document\.getElementById\('satg-top-filter-bar'\);[\s\S]*?_satgClearFiltersBtn = document\.getElementById\('satg-clear-filters-btn'\);/;
js = js.replace(oldDomRegex, newDomInit);

const newEvents = `        if (_satgStatusSelect) _satgStatusSelect.addEventListener('change', _applySatgFilters);
        if (_satgSortRadios) {
            _satgSortRadios.forEach(radio => {
                radio.addEventListener('change', _applySatgFilters);
            });
        }`;

let oldEventsRegex = /\/\/ Configurar botões de rádio de data \(SAT-G\)[\s\S]*?_applySatgFilters\(\);\s*\}\);\s*\}/;
js = js.replace(oldEventsRegex, newEvents);

const newFilterCode = `function _applySatgFilters() {
        const query = _satgSearchInput ? _satgSearchInput.value.toLowerCase().trim() : '';
        const statusFilter = _satgStatusSelect ? _satgStatusSelect.value.toLowerCase() : 'all';
        
        let sortOrder = 'desc';
        if (_satgSortRadios) {
            _satgSortRadios.forEach(r => {
                if (r.checked) sortOrder = r.value;
            });
        }

        let filtered = _satgData.filter(d => {
            // Match Status
            const currentStatus = String(d.status).toUpperCase();
            let statusMatch = false;
            if (statusFilter === 'all') {
                statusMatch = true;
            } else if (statusFilter === 'em analise') {
                statusMatch = currentStatus.includes('ANALISE') || currentStatus.includes('ANÁLISE') || currentStatus.trim() === '';
            } else if (statusFilter === 'aprovado') {
                statusMatch = currentStatus.includes('APROVADO');
            } else if (statusFilter === 'recusado') {
                statusMatch = currentStatus.includes('RECUSADO') || currentStatus.includes('ARQUIVADO');
            }
            if (!statusMatch) return false;

            // Match Text Search
            const textMatch = !query || 
                              String(d.codigo).toLowerCase().includes(query) ||
                              String(d.cliente).toLowerCase().includes(query) ||
                              String(d.cpf).toLowerCase().includes(query);
            if (!textMatch) return false;

            return true;
        });

        // Ordenar os dados
        filtered.sort((a, b) => {
            const dateA = _parseDate(a.data).getTime();
            const dateB = _parseDate(b.data).getTime();
            if (sortOrder === 'asc') {
                return dateA - dateB; // Antigas primeiro
            } else {
                return dateB - dateA; // Recentes primeiro
            }
        });

        _filteredSatgData = filtered;

        _satgCurrentPage = 1;
        _renderSatgTable();
    }`;

let filterCodeRegex = /function _applySatgFilters\(\) \{[\s\S]*?_renderSatgTable\(\);\r?\n\s+\}/;
js = js.replace(filterCodeRegex, newFilterCode);

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('JS Logic updated for simplified sorting filter');
