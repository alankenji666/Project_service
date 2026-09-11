import re

with open('js/modulos/gerenciarGarantia.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_render = '''    function _renderSatgObservationHistory(history) {
        if (!history || history.length === 0) {
            _satgObservationHistory.innerHTML = '<p class="text-gray-500 text-center italic py-4">Nenhuma observação registrada.</p>';
            return;
        }

        const currentUsername = localStorage.getItem('nome') || 'Usuário Local';
        let html = '';

        history.forEach(obs => {
            const isMe = obs.user === currentUsername;
            const alignClass = isMe ? 'justify-end' : 'justify-start';
            const bgClass = isMe ? 'bg-blue-100 text-blue-900 border-blue-200' : 'bg-white text-gray-800 border-gray-200';
            const radiusClass = isMe ? 'rounded-l-2xl rounded-tr-2xl rounded-br-sm' : 'rounded-r-2xl rounded-tl-2xl rounded-bl-sm';
            
            let dateStr = obs.date;
            try {
                if (obs.date && obs.date.includes('T')) {
                    const d = new Date(obs.date);
                    dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                }
            } catch (e) {}

            html += 
                <div class="flex  mb-3 group">
                    <div class="max-w-[85%]">
                        <div class="flex items-baseline gap-2 mb-1 ">
                            <span class="text-xs font-bold text-gray-700"></span>
                            <span class="text-[10px] text-gray-400 font-medium"></span>
                        </div>
                        <div class="  border shadow-sm px-4 py-2.5 text-[13px] whitespace-pre-wrap leading-relaxed"></div>
                    </div>
                </div>
            ;
        });

        _satgObservationHistory.innerHTML = html;
        setTimeout(() => {
            _satgObservationHistory.scrollTop = _satgObservationHistory.scrollHeight;
        }, 10);
    }'''

new_render = '''    function _renderSatgObservationHistory(history) {
        if (!history || history.length === 0) {
            _satgObservationHistory.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhuma observação registrada.</p>';
            return;
        }

        const chatHtml = history.map((obs, idx) => {
            // Suporte para legado e array de strings
            let timestamp = '';
            let message = '';
            if (typeof obs === 'string') {
                const parts = obs.split(' - ');
                timestamp = parts.length > 1 ? parts[0] : '';
                message = parts.length > 1 ? parts.slice(1).join(' - ') : obs;
            } else {
                message = obs.text || '';
                timestamp = obs.date || '';
                try {
                    if (timestamp && timestamp.includes('T')) {
                        const d = new Date(timestamp);
                        timestamp = d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
                    }
                } catch(e) {}
            }

            return 
            <div class="relative group p-3 rounded-lg bg-blue-100 text-gray-800 max-w-md self-start mb-3">
                <button class="delete-obs-satg-btn absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-500 hover:text-red-700" 
                    data-obs-index="" title="Excluir esta observação">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
                    </svg>
                </button>
                <p class="text-sm whitespace-pre-wrap pr-4"></p>
                <div class="flex items-center justify-end mt-1">
                    <span class="text-xs text-gray-500 mr-1"></span>
                    <span title="Salvo"><svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></span>
                </div>
            </div>;
        }).join('');
        _satgObservationHistory.innerHTML = chatHtml;
        _satgObservationHistory.scrollTop = _satgObservationHistory.scrollHeight;

        _satgObservationHistory.querySelectorAll('.delete-obs-satg-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idx = parseInt(btn.dataset.obsIndex, 10);
                const rowIndex = _satgObservationModal.dataset.rowIndex;
                const req = _satgData.find(d => String(d.rowIndex) === String(rowIndex));
                if (req) {
                    let currHistory = [];
                    try {
                        currHistory = JSON.parse(req.observacaoSatg);
                        if (Array.isArray(currHistory)) {
                            currHistory.splice(idx, 1);
                            const newObservacaoJSON = currHistory.length > 0 ? JSON.stringify(currHistory) : '';
                            
                            try {
                                const res = await fetch(API_URLS.GARANTIA_SATG_UPDATE, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ rowIndex: req.rowIndex, observacaoSatg: newObservacaoJSON })
                                });
                                if (!res.ok) throw new Error();
                                req.observacaoSatg = newObservacaoJSON;
                                _openSatgObservationModal(req); // reload modal
                                _fetchSatGData();
                            } catch (err) {
                                alert("Erro ao excluir observação");
                            }
                        }
                    } catch (err) {}
                }
            });
        });
    }'''

content = content.replace(old_render, new_render)

old_save = '''        const currentUsername = localStorage.getItem('nome') || 'Usuário Local';
        history.push({
            user: currentUsername,
            date: new Date().toISOString(),
            text: newText
        });'''

new_save = '''        const d = new Date();
        const timestampStr = d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        const newMsgStr = ${timestampStr} - ;
        history.push(newMsgStr);'''

content = content.replace(old_save, new_save)


with open('js/modulos/gerenciarGarantia.js', 'w', encoding='utf-8') as f:
    f.write(content)
