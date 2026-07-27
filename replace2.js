const fs = require('fs');
const file = 'index.html';
let content = fs.readFileSync(file, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

const target1 = `                <div>
                    <label class="block text-xs font-semibold text-gray-500 mb-1">Assunto</label>
                    <input type="text" id="email-danfe-subject" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-500 mb-1">Mensagem</label>
                    <textarea id="email-danfe-message" rows="4" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"></textarea>
                </div>`;

const rep1 = `                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label class="block text-xs font-semibold text-gray-500">Assunto</label>
                        <button type="button" onclick="window.copyToClipboard('email-danfe-subject')" class="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Copiar</button>
                    </div>
                    <input type="text" id="email-danfe-subject" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                </div>
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label class="block text-xs font-semibold text-gray-500">Mensagem</label>
                        <button type="button" onclick="window.copyToClipboard('email-danfe-message')" class="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Copiar</button>
                    </div>
                    <textarea id="email-danfe-message" rows="4" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"></textarea>
                </div>`;

const target2 = `                    <div class="text-xs text-indigo-800 flex-1">
                        <span class="font-bold">Anexo:</span> <span id="email-danfe-filename">DANFE.pdf</span><br>
                        <span class="text-[10px] text-indigo-600 font-bold flex items-center gap-1 mt-0.5">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"></path></svg>
                            Clique e ARRASTE para dentro do e-mail no Outlook!
                        </span>
                    </div>
                </div>`;

const rep2 = `                    <div class="text-xs text-indigo-800 flex-1">
                        <span class="font-bold">Anexo:</span> <span id="email-danfe-filename">DANFE.pdf</span><br>
                        <span class="text-[10px] text-indigo-600 font-bold flex items-center gap-1 mt-0.5">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"></path></svg>
                            Clique e ARRASTE para dentro do e-mail no Outlook!
                        </span>
                    </div>
                    <button type="button" id="email-danfe-download-btn" class="ml-2 px-3 py-1.5 bg-indigo-200 hover:bg-indigo-300 text-indigo-800 rounded-md text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        Baixar
                    </button>
                </div>`;

let success = false;
if (content.includes(target1.replace(/\r\n/g, '\n'))) {
    content = content.replace(target1.replace(/\r\n/g, '\n'), rep1);
    success = true;
}
if (content.includes(target2.replace(/\r\n/g, '\n'))) {
    content = content.replace(target2.replace(/\r\n/g, '\n'), rep2);
    success = true;
}

if(success) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('SUCCESS');
} else {
    console.log('TARGETS NOT FOUND');
}
