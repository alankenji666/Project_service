import re

with open('js/modulos/gerenciarGarantia.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix hide logic
content = content.replace('.satg-custom-dropdown-menu:not(.hidden), .pedido-custom-dropdown-menu:not(.hidden)', '.satg-custom-dropdown-menu:not(.hidden), .pedido-custom-dropdown-menu:not(.hidden), .retorno-custom-dropdown-menu:not(.hidden)')

# Listeners logic
listeners = '''
            const retBtn = tr.querySelector('.retorno-custom-dropdown-btn');
            const retMenu = tr.querySelector('.retorno-custom-dropdown-menu');
            if (retBtn && retMenu) {
                retBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.satg-custom-dropdown-menu:not(.hidden), .pedido-custom-dropdown-menu:not(.hidden), .retorno-custom-dropdown-menu:not(.hidden)').forEach(m => {
                        if (m !== retMenu) m.classList.add('hidden');
                    });
                    retMenu.classList.toggle('hidden');
                });
                retMenu.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        retMenu.classList.add('hidden');
                        const newRetorno = btn.dataset.value;
                        if (newRetorno === retornoStatus) return;
                        
                        retBtn.classList.add('animate-pulse', 'opacity-50');
                        retBtn.disabled = true;
                        try {
                            const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ rowIndex: req.rowIndex, retornoItem: newRetorno })
                            });
                            if (!res.ok) throw new Error();
                            _fetchSatGData();
                        } catch (err) {
                            alert("Erro ao atualizar Retorno de Item");
                            _fetchSatGData();
                        }
                    });
                });
            }

            const btnObs = tr.querySelector('.btn-observacao-satg');
            if (btnObs) {
                btnObs.onclick = async (e) => {
                    e.stopPropagation();
                    if (typeof Swal !== 'undefined') {
                        const { value: text } = await Swal.fire({
                            title: 'Observação SAT-G',
                            input: 'textarea',
                            inputLabel: 'Anotações sobre a logística, defeito ou detalhes',
                            inputValue: req.observacaoSatg || '',
                            showCancelButton: true,
                            confirmButtonText: 'Salvar',
                            cancelButtonText: 'Cancelar',
                            confirmButtonColor: '#10b981',
                            cancelButtonColor: '#d1d5db',
                            inputValidator: (value) => {
                                // Pode ser vazio
                            }
                        });

                        if (text !== undefined && text !== (req.observacaoSatg || '')) {
                            try {
                                btnObs.classList.add('animate-spin');
                                const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ rowIndex: req.rowIndex, observacaoSatg: text })
                                });
                                if (!res.ok) throw new Error();
                                _fetchSatGData();
                            } catch (err) {
                                alert("Erro ao salvar observação");
                                _fetchSatGData();
                            }
                        }
                    } else {
                        const text = prompt('Observação SAT-G:', req.observacaoSatg || '');
                        if (text !== null && text !== (req.observacaoSatg || '')) {
                            try {
                                btnObs.innerHTML = '...';
                                const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ rowIndex: req.rowIndex, observacaoSatg: text })
                                });
                                if (!res.ok) throw new Error();
                                _fetchSatGData();
                            } catch (err) {
                                alert("Erro ao salvar observação");
                                _fetchSatGData();
                            }
                        }
                    }
                };
            }
'''

content = content.replace('            const btnAvaliar = tr.querySelector(\'.btn-avaliar-satg\');', listeners + '\\n            const btnAvaliar = tr.querySelector(\'.btn-avaliar-satg\');')


with open('js/modulos/gerenciarGarantia.js', 'w', encoding='utf-8') as f:
    f.write(content)
