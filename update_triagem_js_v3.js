const fs = require('fs');

let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// Update variables
let oldVarsRegex = /let _satgStatusSelect;\s*let _satgSortRadios;/;
let newVars = `let _satgStatusSelect;
    let _satgOrcamentoSelect;
    let _satgRetornoSelect;
    let _satgSortRadios;`;
js = js.replace(oldVarsRegex, newVars);

// Update DOM init
let oldDomRegex = /_satgStatusSelect = document\.getElementById\('satg-status-select'\);\s*_satgSortRadios = document\.querySelectorAll\('\.satg-sort-radio'\);/;
let newDom = `_satgStatusSelect = document.getElementById('satg-status-select');
        _satgOrcamentoSelect = document.getElementById('satg-orcamento-select');
        _satgRetornoSelect = document.getElementById('satg-retorno-select');
        _satgSortRadios = document.querySelectorAll('.satg-sort-radio');`;
js = js.replace(oldDomRegex, newDom);

// Update Listeners
let oldListenersRegex = /if \(_satgStatusSelect\) _satgStatusSelect\.addEventListener\('change', _applySatgFilters\);/;
let newListeners = `if (_satgStatusSelect) _satgStatusSelect.addEventListener('change', _applySatgFilters);
        if (_satgOrcamentoSelect) _satgOrcamentoSelect.addEventListener('change', _applySatgFilters);
        if (_satgRetornoSelect) _satgRetornoSelect.addEventListener('change', _applySatgFilters);`;
js = js.replace(oldListenersRegex, newListeners);

// Update Filter Logic
let startFilterIdx = js.indexOf('function _applySatgFilters() {');
let endFilterStr = '        _satgCurrentPage = 1;\n        _renderSatgTable();\n    }';
let endFilterStr2 = '        _satgCurrentPage = 1;\r\n        _renderSatgTable();\r\n    }';
let endFilterIdx = js.indexOf(endFilterStr, startFilterIdx);
if(endFilterIdx === -1) endFilterIdx = js.indexOf(endFilterStr2, startFilterIdx);

if (startFilterIdx !== -1 && endFilterIdx !== -1) {
    let replaceEnd = js.indexOf('}', endFilterIdx) + 1;
    let newFilterLogic = `function _applySatgFilters() {
        const query = _satgSearchInput ? _satgSearchInput.value.toLowerCase().trim() : '';
        const statusFilter = _satgStatusSelect ? _satgStatusSelect.value.toLowerCase() : 'all';
        const orcamentoFilter = _satgOrcamentoSelect ? _satgOrcamentoSelect.value.toLowerCase() : 'all';
        const retornoFilter = _satgRetornoSelect ? _satgRetornoSelect.value.toLowerCase() : 'all';
        
        let sortOrder = 'desc';
        if (_satgSortRadios) {
            _satgSortRadios.forEach(r => {
                if (r.checked) sortOrder = r.value;
            });
        }

        const normalizeStr = (str) => {
            return str.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
        };

        let filtered = _satgData.filter(d => {
            // 1. Filtro Texto (Busca)
            const textMatch = !query || 
                              String(d.codigo).toLowerCase().includes(query) ||
                              String(d.cliente).toLowerCase().includes(query) ||
                              String(d.cpf).toLowerCase().includes(query);
            if (!textMatch) return false;

            // 2. Filtro Situação Garantia
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

            // 3. Filtro Situação Orçamento
            let visualOrcamentoStatus = 'EM ANALISE';
            if (currentStatus.includes('RECUSADO')) {
                visualOrcamentoStatus = 'CANCELADO';
            } else if (d.idPedido) {
                const pVinculado = typeof _pedidosGarantiaData !== 'undefined' ? _pedidosGarantiaData.find(p => String(p.idPedido || p.numero || p.id || '') === String(d.idPedido)) : null;
                if (pVinculado && pVinculado.situacao) {
                    visualOrcamentoStatus = pVinculado.situacao.toUpperCase();
                    if (visualOrcamentoStatus === 'PENDENTE') visualOrcamentoStatus = 'EM ANALISE';
                }
            }

            let orcMatch = false;
            if (orcamentoFilter === 'all') {
                orcMatch = true;
            } else {
                const normPStatus = normalizeStr(visualOrcamentoStatus);
                const normFilter = normalizeStr(orcamentoFilter);
                if (normPStatus.includes(normFilter)) orcMatch = true;
            }
            if (!orcMatch) return false;

            // 4. Filtro Situação Retorno
            let visualRetornoStatus = (d.retornoItem || 'EM ANALISE').toUpperCase();
            if (currentStatus.includes('RECUSADO')) {
                visualRetornoStatus = 'CANCELADO';
            }
            let retMatch = false;
            if (retornoFilter === 'all') {
                retMatch = true;
            } else {
                const normRStatus = normalizeStr(visualRetornoStatus);
                const normRFilter = normalizeStr(retornoFilter);
                if (normRStatus.includes(normRFilter)) retMatch = true;
            }
            if (!retMatch) return false;

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
    js = js.substring(0, startFilterIdx) + newFilterLogic + js.substring(replaceEnd);
    fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
    console.log('JS logic updated for 3 filters.');
} else {
    console.log('Error finding _applySatgFilters block.');
}
