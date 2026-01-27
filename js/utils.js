/**
 * utils.js
 * 
 * Funções utilitárias reutilizáveis para a aplicação.
 */

/**
 * Cria um "debouncer" para uma função, que atrasa sua execução até que um certo tempo tenha passado sem que ela seja chamada.
 * @param {Function} func A função a ser "debounced".
 * @param {number} delay O tempo de espera em milissegundos.
 * @returns {Function} A nova função "debounced".
 */
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * Adiciona um número de dias úteis a uma data.
 * @param {Date} startDate A data inicial.
 * @param {number} days O número de dias úteis a serem adicionados.
 * @returns {Date} A nova data.
 */
export function addBusinessDays(startDate, days) {
    let currentDate = new Date(startDate.getTime());
    let addedDays = 0;
    while (addedDays < days) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Domingo, 6 = Sábado
            addedDays++;
        }
    }
    return currentDate;
}

/**
 * Calcula a diferença em dias úteis entre duas datas.
 * @param {Date} startDate A data inicial.
 * @param {Date} endDate A data final.
 * @returns {number} O número de dias úteis.
 */
export function getBusinessDaysDifference(startDate, endDate) {
    let count = 0;
    const curDate = new Date(startDate.getTime());
    while (curDate <= endDate) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
}

/**
 * Formata um número como CNPJ ou CPF.
 * @param {string} value O valor a ser formatado.
 * @returns {string} O valor formatado.
 */
export function formatCnpjCpf(value) {
    if (!value) return 'N/A';
    const cnpjCpf = value.replace(/\D/g, '');
    if (cnpjCpf.length === 11) {
        return cnpjCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (cnpjCpf.length === 14) {
        return cnpjCpf.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return value;
}

/**
 * Cria um item de detalhe (label + valor) para o painel de detalhes do produto.
 * @param {string} label O rótulo do detalhe.
 * @param {string|number} value O valor do detalhe.
 * @returns {string} O HTML do item de detalhe.
 */
export function createDetailItem(label, value) {
    return `
        <div class="bg-gray-50 p-3 rounded-lg">
            <p class="text-sm font-medium text-gray-500">${label}</p>
            <p class="text-lg text-gray-800 font-semibold">${value ?? 'N/A'}</p>
        </div>
    `;
}

/**
 * Cria uma pílula de status visual.
 * @param {string} status O status ('ok', 'baixo', 'excesso', 'indefinido').
 * @returns {string} O HTML da pílula.
 */
export function createStatusPill(status) {
    const statusMap = {
        ok: { text: 'OK', class: 'bg-green-100 text-green-800' },
        baixo: { text: 'Baixo', class: 'bg-yellow-100 text-yellow-800' },
        excesso: { text: 'Excesso', class: 'bg-red-100 text-red-800' },
        indefinido: { text: 'Indefinido', class: 'bg-gray-100 text-gray-800' }
    };
    const { text, class: pillClass } = statusMap[status] || statusMap.indefinido;
    return `<span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${pillClass}">${text}</span>`;
}

/**
 * NOVO: Posiciona um tooltip em relação ao cursor do mouse.
 * @param {MouseEvent} event - O evento do mouse.
 * @param {HTMLElement} tooltipElement - O elemento do tooltip a ser posicionado.
 */
export function positionTooltip(event, tooltipElement) {
    if (!event || !tooltipElement) return;

    tooltipElement.style.visibility = 'hidden';
    tooltipElement.classList.remove('hidden');

    // Usa getBoundingClientRect para obter dimensões precisas
    const { width: tooltipWidth, height: tooltipHeight } = tooltipElement.getBoundingClientRect(); // Declaração única


    // Usa clientX/clientY para posicionamento relativo à viewport, o que é melhor para elementos 'fixed'
    let top = event.clientY - tooltipHeight - 15; // 15px de espaço acima do cursor
    let left = event.clientX - (tooltipWidth / 2);

    // Ajusta a posição para não sair da tela
    if (top < window.scrollY) top = event.pageY + 25; // Se for sair pelo topo, mostra abaixo
    if (left < window.scrollX) left = window.scrollX + 5;
    if (left + tooltipWidth > window.innerWidth + window.scrollX) left = window.innerWidth + window.scrollX - tooltipWidth - 5;

    tooltipElement.style.top = `${top}px`;
    tooltipElement.style.left = `${left}px`;
    tooltipElement.style.visibility = 'visible';
    tooltipElement.style.opacity = '1';
}