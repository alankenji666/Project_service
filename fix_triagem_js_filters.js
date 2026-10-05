const fs = require('fs');

let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// We need to inject the filter logic.
const codeToInject = `
    let _satgTopFilterBar;
    let _satgYearFilter;
    let _satgStartDate;
    let _satgEndDate;
    let _satgStatusSelect;
    let _satgDateRadios;
    let _satgClearFiltersBtn;
`;

if(!js.includes('_satgTopFilterBar')) {
    js = js.replace('let _satgFilterBtn;', codeToInject + '\n    let _satgFilterBtn;');
}

const initDomToInject = `
        _satgTopFilterBar = document.getElementById('satg-top-filter-bar');
        _satgYearFilter = document.getElementById('satg-year-filter');
        _satgStartDate = document.getElementById('satg-start-date');
        _satgEndDate = document.getElementById('satg-end-date');
        _satgStatusSelect = document.getElementById('satg-status-select');
        _satgDateRadios = document.querySelectorAll('.satg-date-radio');
        _satgClearFiltersBtn = document.getElementById('satg-clear-filters-btn');
`;

if(!js.includes("_satgTopFilterBar = document.getElementById('satg-top-filter-bar');")) {
    js = js.replace("_satgFilterBtn = document.getElementById('btn-satg-filter');", initDomToInject + "\n        _satgFilterBtn = document.getElementById('btn-satg-filter');");
}

const setupEventsCodeToInject = `
        // Configurar botões de rádio de data (SAT-G)
        if (_satgDateRadios) {
            _satgDateRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        const today = new Date();
                        let start = new Date();
                        let end = new Date();
                        const val = e.target.value;

                        if (val === 'current_month') {
                            start = new Date(today.getFullYear(), today.getMonth(), 1);
                            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        } else if (val === 'last_month') {
                            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                            end = new Date(today.getFullYear(), today.getMonth(), 0);
                        } else if (val === 'last_3_months') {
                            start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
                            end = new Date(today.getFullYear(), today.getMonth(), 0);
                        } else if (val === 'last_6_months') {
                            start = new Date(today.getFullYear(), today.getMonth() - 6, 1);
                            end = new Date(today.getFullYear(), today.getMonth(), 0);
                        } else if (val === '30') {
                            start.setDate(today.getDate() - 30);
                        } else if (val === '60') {
                            start.setDate(today.getDate() - 60);
                        } else if (val === '90') {
                            start.setDate(today.getDate() - 90);
                        }

                        if (val !== 'all') {
                            _satgStartDate.value = start.toISOString().split('T')[0];
                            _satgEndDate.value = end.toISOString().split('T')[0];
                        } else {
                            _satgStartDate.value = '';
                            _satgEndDate.value = '';
                        }
                        
                        // Reseta o filtro de Ano quando usar atalhos de data (exceto 'all' com datas em branco)
                        if (val !== 'all') {
                            _satgYearFilter.value = 'all';
                        }
                        _applySatgFilters();
                    }
                });
            });
        }

        if (_satgYearFilter) {
            _satgYearFilter.addEventListener('change', () => {
                // Ao mudar o ano, limpar as datas exatas e radios
                if (_satgYearFilter.value !== 'all') {
                    _satgStartDate.value = '';
                    _satgEndDate.value = '';
                    _satgDateRadios.forEach(r => r.checked = false);
                } else {
                    const allRadio = Array.from(_satgDateRadios || []).find(r => r.value === 'all');
                    if (allRadio) allRadio.checked = true;
                }
                _applySatgFilters();
            });
        }

        if (_satgStartDate) _satgStartDate.addEventListener('change', () => { _satgDateRadios.forEach(r => r.checked = false); _satgYearFilter.value = 'all'; _applySatgFilters(); });
        if (_satgEndDate) _satgEndDate.addEventListener('change', () => { _satgDateRadios.forEach(r => r.checked = false); _satgYearFilter.value = 'all'; _applySatgFilters(); });
        if (_satgStatusSelect) _satgStatusSelect.addEventListener('change', _applySatgFilters);
        if (_satgClearFiltersBtn) {
            _satgClearFiltersBtn.addEventListener('click', () => {
                if (_satgSearchInput) _satgSearchInput.value = '';
                if (_satgYearFilter) _satgYearFilter.value = 'all';
                if (_satgStartDate) _satgStartDate.value = '';
                if (_satgEndDate) _satgEndDate.value = '';
                if (_satgStatusSelect) _satgStatusSelect.value = 'em analise';
                if (_satgDateRadios) {
                    const allRadio = Array.from(_satgDateRadios).find(r => r.value === 'all');
                    if (allRadio) allRadio.checked = true;
                }
                _applySatgFilters();
            });
        }
`;

if(!js.includes('satg-date-radio')) {
    js = js.replace('if (_satgSearchInput) _satgSearchInput.addEventListener(\'input\', _applySatgFilters);', 'if (_satgSearchInput) _satgSearchInput.addEventListener(\'input\', _applySatgFilters);\n' + setupEventsCodeToInject);
}

// Function replacement using regex or split
let applySatgFiltersCode = `function _applySatgFilters() {
        const query = _satgSearchInput ? _satgSearchInput.value.toLowerCase().trim() : '';
        
        let startDt = null, endDt = null;
        if (_satgStartDate && _satgStartDate.value) {
            const p = _satgStartDate.value.split('-');
            startDt = new Date(p[0], p[1]-1, p[2], 0, 0, 0);
        }
        if (_satgEndDate && _satgEndDate.value) {
            const p = _satgEndDate.value.split('-');
            endDt = new Date(p[0], p[1]-1, p[2], 23, 59, 59);
        }
        const yearFilter = (_satgYearFilter && _satgYearFilter.value !== 'all') ? _satgYearFilter.value : null;
        const statusFilter = _satgStatusSelect ? _satgStatusSelect.value.toLowerCase() : 'all';

        _filteredSatgData = _satgData.filter(d => {
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

            // Match Date
            const dData = _parseDate(d.data);
            if (yearFilter && dData.getFullYear().toString() !== yearFilter) return false;
            if (startDt && dData < startDt) return false;
            if (endDt && dData > endDt) return false;

            return true;
        });

        _satgCurrentPage = 1;
        _renderSatgTable();
    }`;

// let's split from `    function _applySatgFilters() {` to `        _satgCurrentPage = 1;\r\n        _renderSatgTable();\r\n    }`
// Actually I'll just find the start and end of it.
let startIdx = js.indexOf('function _applySatgFilters() {');
if(startIdx > -1) {
    let endStr = '        _renderSatgTable();\r\n    }';
    let endStr2 = '        _renderSatgTable();\n    }';
    let endIdx = js.indexOf(endStr, startIdx);
    if(endIdx === -1) endIdx = js.indexOf(endStr2, startIdx);
    
    if(endIdx > -1) {
        let replaceEnd = js.indexOf('}', endIdx) + 1;
        js = js.substring(0, startIdx) + applySatgFiltersCode + js.substring(replaceEnd);
        console.log('Replaced _applySatgFilters');
    }
}

// Populate years
const populateYearsCode = `
            // Popular combo de anos da SatG
            if (_satgYearFilter) {
                const years = new Set();
                pData.forEach(d => {
                    const dt = _parseDate(d.data);
                    if (dt && dt.getFullYear() > 2000) years.add(dt.getFullYear());
                });
                const sortedYears = Array.from(years).sort((a,b)=>b-a);
                const currentVal = _satgYearFilter.value;
                _satgYearFilter.innerHTML = '<option value="all">Tudo</option>';
                sortedYears.forEach(y => {
                    _satgYearFilter.innerHTML += \`<option value="\${y}">\${y}</option>\`;
                });
                if (Array.from(_satgYearFilter.options).some(o => o.value === currentVal)) {
                    _satgYearFilter.value = currentVal;
                }
            }
`;

if(!js.includes('Popular combo de anos da SatG')) {
    js = js.replace('_satgData = pData;', '_satgData = pData;\n' + populateYearsCode);
}

// Hide the old filter button logic (instead of breaking html, just hide it via JS on load)
const hideOldFilterCode = `
        if (_satgFilterBtn) _satgFilterBtn.parentElement.classList.add('hidden');
        if (_satgTopFilterBar) _satgTopFilterBar.classList.remove('hidden');
`;
if(!js.includes('_satgTopFilterBar.classList.remove')) {
    js = js.replace('_applySatgFilters();', hideOldFilterCode + '\n        _applySatgFilters();');
}

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Successfully updated gerenciarGarantia.js for new filter');
