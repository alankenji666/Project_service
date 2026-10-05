const fs = require('fs');

// 1. index.html
let html = fs.readFileSync('index.html', 'utf8');
const searchHtml = `<input type="text" id="modal-generic-edit-input" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-gray-800 font-medium" autocomplete="off">`;
const replaceHtml = searchHtml + `\n                    <select id="modal-generic-edit-select" class="hidden w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-gray-800 font-medium"></select>`;

if (!html.includes('id="modal-generic-edit-select"')) {
    html = html.replace(searchHtml, replaceHtml);
    fs.writeFileSync('index.html', html);
}

// 2. gerenciarGarantia.js
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// Replace injectEditPencil definition
js = js.replace(/function injectEditPencil\(elementId, column, key, currentValue, type = 'text'\) \{/g, 'function injectEditPencil(elementId, column, key, currentValue, options = null) {');

// Replace openCustomPrompt definition
js = js.replace(/function _openCustomPrompt\(title, initialValue, callback, type\) \{/g, 'function _openCustomPrompt(title, initialValue, callback, options = null) {');

// Fix the call inside injectEditPencil to pass options:
// From: _openCustomPrompt(labelText, currentValue || '', async (newValue) => { ... });
// To:   _openCustomPrompt(labelText, currentValue || '', async (newValue) => { ... }, options);
js = js.replace(/(\_openCustomPrompt\(labelText, currentValue \|\| '', async \(newValue\) => \{[\s\S]*?\}\);)/, (match) => {
    return match.replace(/\}\);$/, '}, options);');
});

// Update the _openCustomPrompt logic
const oldLogicRegex = /function _openCustomPrompt\(title, initialValue, callback, options = null\) \{[\s\S]*?modal\.classList\.remove\('hidden'\);\n        \}/;

const newLogic = `function _openCustomPrompt(title, initialValue, callback, options = null) {
            const modal = document.getElementById('modal-generic-edit');
            const titleEl = document.getElementById('modal-generic-edit-title');
            const labelEl = document.getElementById('modal-generic-edit-label');
            const inputEl = document.getElementById('modal-generic-edit-input');
            const selectEl = document.getElementById('modal-generic-edit-select');
            const btnCancel = document.getElementById('btn-cancel-generic-edit');
            const btnSave = document.getElementById('btn-save-generic-edit');
            const btnClose = document.getElementById('btn-close-generic-edit');

            if (!modal) return;

            titleEl.innerText = 'Editar Campo';
            labelEl.innerText = title;
            
            // Clone nodes to remove old listeners
            const newBtnSave = btnSave.cloneNode(true);
            btnSave.parentNode.replaceChild(newBtnSave, btnSave);
            const newBtnCancel = btnCancel.cloneNode(true);
            btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
            const newBtnClose = btnClose.cloneNode(true);
            btnClose.parentNode.replaceChild(newBtnClose, btnClose);
            const newInput = inputEl.cloneNode(true);
            inputEl.parentNode.replaceChild(newInput, inputEl);
            
            let newSelect = null;
            if (selectEl) {
                newSelect = selectEl.cloneNode(true);
                selectEl.parentNode.replaceChild(newSelect, selectEl);
            }

            let isSelect = options && Array.isArray(options) && newSelect;

            if (isSelect) {
                newInput.classList.add('hidden');
                newSelect.classList.remove('hidden');
                newSelect.innerHTML = options.map(opt => \`<option value="\${opt}" \${opt === initialValue ? 'selected' : ''}>\${opt}</option>\`).join('');
            } else {
                if (newSelect) newSelect.classList.add('hidden');
                newInput.classList.remove('hidden');
                newInput.value = initialValue || '';
            }

            const closeModal = () => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            };

            const handleSave = () => {
                const finalVal = isSelect ? newSelect.value : newInput.value;
                if (callback) callback(finalVal);
                closeModal();
            };

            newBtnCancel.addEventListener('click', closeModal);
            newBtnClose.addEventListener('click', closeModal);
            newBtnSave.addEventListener('click', handleSave);
            
            if (!isSelect) {
                newInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') closeModal();
                });
            } else {
                newSelect.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') closeModal();
                });
            }

            modal.classList.add('flex');
            modal.classList.remove('hidden');
            
            if (!isSelect) {
                newInput.focus();
                newInput.select();
            } else {
                newSelect.focus();
            }
        }`;

js = js.replace(oldLogicRegex, newLogic);

// Add the options to the 'revenda' injectEditPencil call
js = js.replace(/injectEditPencil\('satg-modal-revenda', 'H', 'revenda', req\.revenda\);/g, "injectEditPencil('satg-modal-revenda', 'H', 'revenda', req.revenda, ['Sim', 'Não', 'NÃO', 'SIM']);");
// just in case they used uppercase, I will normalize options to Sim/Não in display but maybe backend stores uppercase?
// Wait, the screenshot shows "NÃO".
js = js.replace(/injectEditPencil\('satg-modal-revenda', 'H', 'revenda', req\.revenda, \['Sim', 'Não', 'NÃO', 'SIM'\]\);/g, "injectEditPencil('satg-modal-revenda', 'H', 'revenda', req.revenda, ['SIM', 'NÃO']);");

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('Feito!');
