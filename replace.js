const fs = require('fs');
const file = 'index.html';
let content = fs.readFileSync(file, 'utf8');

// Normalize line endings to help match
content = content.replace(/\r\n/g, '\n');

const target = `                <div class="bg-indigo-50 p-3 rounded border border-indigo-100 flex items-start gap-2">
                    <svg class="w-4 h-4 text-indigo-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                    <div class="text-xs text-indigo-700">
                        <span class="font-bold">Anexo:</span> <span id="email-danfe-filename">DANFE.pdf</span> será anexado automaticamente.
                    </div>
                </div>`;
const normalizedTarget = target.replace(/\r\n/g, '\n');

const replacement = `                <div id="email-danfe-drag-area" draggable="true" class="bg-indigo-50 hover:bg-indigo-100 p-3 rounded border border-indigo-300 flex items-center gap-3 cursor-grab active:cursor-grabbing transition-colors shadow-sm" title="Clique e arraste este anexo direto para o Outlook!">
                    <div class="bg-indigo-600 p-2 rounded-lg text-white">
                        <svg class="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                    </div>
                    <div class="text-xs text-indigo-800 flex-1">
                        <span class="font-bold">Anexo:</span> <span id="email-danfe-filename">DANFE.pdf</span><br>
                        <span class="text-[10px] text-indigo-600 font-bold flex items-center gap-1 mt-0.5">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"></path></svg>
                            Clique e ARRASTE para dentro do e-mail no Outlook!
                        </span>
                    </div>
                </div>`;

if (content.includes(normalizedTarget)) {
    content = content.replace(normalizedTarget, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log('SUCCESS');
} else {
    console.log('TARGET NOT FOUND');
}
