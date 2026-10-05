const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// The corrupted block currently looks something like this:
// <div class="mb-4">
// <label ...>Avaliação Interna (Constatação do Problema) *</label>
// <textarea id="satg-modal-observacao" rows="3" ...></textarea>
// <label ...>Solução do Problema (Ação Peças)</label>
// <textarea id="satg-modal-acao-pecas" rows="2" ...></textarea>
// </div>rea>
// </div>
// </div>

// Let's use Regex to find everything from `<div class="mb-4">` containing `satg-modal-observacao` up to `</div>rea>` or the closing of the parent.
// Actually, it's safer to find the Exact corrupted string and replace it.

// Let's print out the exact string around the corruption to build a safe replace.
let lines = html.split('\\n');
let corruptLineIdx = lines.findIndex(l => l.includes('</div>rea>'));
console.log('CORRUPT LINE:', lines[corruptLineIdx]);
