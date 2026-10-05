const fs = require('fs');

// 1. index.html
let html = fs.readFileSync('index.html', 'utf8');
const searchHtml = `<input type="text" id="modal-generic-edit-input" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-gray-800 font-medium" autocomplete="off">`;
const replaceHtml = searchHtml + `\n                    <select id="modal-generic-edit-select" class="hidden w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-gray-800 font-medium"></select>`;

if (!html.includes('id="modal-generic-edit-select"')) {
    html = html.replace(searchHtml, replaceHtml);
    fs.writeFileSync('index.html', html);
    console.log('index.html modificado.');
}

// 2. gerenciarGarantia.js
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// Modificar injectEditPencil
const searchInject = 'function injectEditPencil(elementId, column, key, currentValue, type = \'text\') {';
const replaceInject = 'function injectEditPencil(elementId, column, key, currentValue, options = null) {';
js = js.replace(searchInject, replaceInject);

const searchInjectCall = `_openCustomPrompt(labelText, currentValue || '', async (newValue) => {`;
const replaceInjectCall = `_openCustomPrompt(labelText, currentValue || '', async (newValue) => {`;
js = js.replace(/_openCustomPrompt\(labelText, currentValue \|\| '', async \(newValue\) => \{/g, '_openCustomPrompt(labelText, currentValue || \'\', async (newValue) => {');

// Precisamos garantir que ele passe o options.
// A linha original era: _openCustomPrompt(labelText, currentValue || '', async (newValue) => {
// E nós queremos: _openCustomPrompt(labelText, currentValue || '', async (newValue) => { ..., options);
// Vamos buscar a definição completa.
js = js.replace(/_openCustomPrompt\(labelText, currentValue \|\| '', async \(newValue\) => \{/g, '_openCustomPrompt(labelText, currentValue || \'\', async (newValue) => {'); // fallback safe, we will manually replace the closing brace of the arrow function in the replace script if needed.

// É mais fácil reescrever a chamada via RegExp:
const oldCall = `_openCustomPrompt(labelText, currentValue || '', async (newValue) => {
                    if (newValue !== null && newValue.trim() !== (currentValue || '').trim()) {`;
const newCall = `_openCustomPrompt(labelText, currentValue || '', async (newValue) => {
                    if (newValue !== null && String(newValue).trim() !== String(currentValue || '').trim()) {`;
js = js.replace(oldCall, newCall); // fix for non string just in case

// Tem que adicionar o parametro `options` no final do _openCustomPrompt...
// "});"
// "                });"
const exactCallBlockRegex = /_openCustomPrompt\(labelText, currentValue \|\| '', async \(newValue\) => \{[\s\S]*?\}\);/g;
js = js.replace(exactCallBlockRegex, (match) => {
    // se já termina com }, options); ignora
    if (match.includes('}, options);')) return match;
    return match.replace(/\}\);$/, '}, options);');
});

// Modificar a definição _openCustomPrompt
const searchOpenPrompt = 'function _openCustomPrompt(title, initialValue, callback, type) {';
const replaceOpenPrompt = 'function _openCustomPrompt(title, initialValue, callback, options = null) {';
js = js.replace(searchOpenPrompt, replaceOpenPrompt);

// Dentro de _openCustomPrompt:
const searchInputLogic = `const inputEl = document.getElementById('modal-generic-edit-input');`;
const replaceInputLogic = `const inputEl = document.getElementById('modal-generic-edit-input');
            const selectEl = document.getElementById('modal-generic-edit-select');`;
js = js.replace(searchInputLogic, replaceInputLogic);

// Substituir as manipulações do inputEl para considerar o selectEl
const searchCloneLogic = `const newInput = inputEl.cloneNode(true);
            inputEl.parentNode.replaceChild(newInput, inputEl);`;
const replaceCloneLogic = `const newInput = inputEl.cloneNode(true);
            inputEl.parentNode.replaceChild(newInput, inputEl);
            const newSelect = selectEl.cloneNode(true);
            selectEl.parentNode.replaceChild(newSelect, selectEl);`;
js = js.replace(searchCloneLogic, replaceCloneLogic);

// Lógica de exibição e valores
const searchValuesLogic = `titleEl.innerText = 'Editar Campo';
            labelEl.innerText = title;
            inputEl.value = initialValue || '';`;
const replaceValuesLogic = `titleEl.innerText = 'Editar Campo';
            labelEl.innerText = title;
            
            if (options && Array.isArray(options)) {
                newInput.classList.add('hidden');
                newSelect.classList.remove('hidden');
                newSelect.innerHTML = options.map(opt => \`<option value="\${opt}" \${opt === initialValue ? 'selected' : ''}>\${opt}</option>\`).join('');
            } else {
                newSelect.classList.add('hidden');
                newInput.classList.remove('hidden');
                newInput.value = initialValue || '';
            }`;
// Nota: a substituição do DOM aqui no clone vai dar ruim se usarmos newInput.
// O código original fazia o clone e depois configurava?
// ORIGINAL:
//             inputEl.value = initialValue || '';
//             // Remove listeners antigos
//             const newBtnSave = btnSave.cloneNode(true);
//             ...
//             const newInput = inputEl.cloneNode(true);
//             inputEl.parentNode.replaceChild(newInput, inputEl);
