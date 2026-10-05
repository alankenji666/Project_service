const fs = require('fs');
let js = fs.readFileSync('js/main.js', 'utf8');

js = js.replace(
    /window\._promptGeneric = _promptGeneric;\s*function _promptGeneric\(title, label, callback, type = "text"\) \{[\s\S]*?const ans = window\.prompt\(label\);/m,
    `window._promptGeneric = _promptGeneric;
function _promptGeneric(title, label, callback, type = "text", defaultValue = "") {
    const modal = document.getElementById('modal-generic-edit');
    if (!modal) {
        const ans = window.prompt(label, defaultValue);`
);

js = js.replace(
    /newInput\.type = type;\s*newInput\.value = '';/m,
    `newInput.type = type;
    newInput.value = defaultValue || '';`
);

fs.writeFileSync('js/main.js', js);
console.log('promptGeneric modificado para suportar defaultValue no main.js');
