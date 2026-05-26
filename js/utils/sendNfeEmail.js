/**
 * Módulo para enviar NF-e por email usando mailto: (Outlook local)
 * Fluxo 100% frontend - sem backend
 */

export function sendNFeByEmail({ to, clientName, nfNumber, nfLink, fromName = 'MKS Service' }) {
    if (!to || !clientName || !nfNumber || !nfLink) {
        alert('Dados incompletos para enviar email. Verifique cliente, NF e link.');
        return;
    }

    const subject = `NF-e Nº ${nfNumber} - ${clientName}`;
    const body = `Olá ${clientName},\n\nSegue a nota fiscal Nº ${nfNumber} disponível no Bling:\n\n${nfLink}\n\nQualquer dúvida, estou à disposição.\n\nAtenciosamente,\n${fromName}`;
    
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Abre o cliente de email padrão (Outlook local)
    window.location.href = mailto;
}

export function createSendNFeButton({ 
    containerSelector, 
    to, 
    clientName, 
    nfNumber, 
    nfLink, 
    label = 'Enviar por Email', 
    className = 'px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded border border-blue-200 font-semibold transition-colors cursor-pointer'
}) {
    const container = document.querySelector(containerSelector);
    if (!container) {
        console.warn('Container não encontrado:', containerSelector);
        return null;
    }
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.title = `Enviar NF-e ${nfNumber} por email`;
    
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        sendNFeByEmail({ to, clientName, nfNumber, nfLink });
    });
    
    container.appendChild(btn);
    return btn;
}
