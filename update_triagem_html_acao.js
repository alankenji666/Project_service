const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const observacaoHtml = `                          <div class="mb-4">
                              <label class="block font-bold text-gray-700 mb-2">Avaliação Interna (Constatação do Problema) *</label>
                              <textarea id="satg-modal-observacao" rows="4" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-none" placeholder="Escreva a avaliação técnica aqui..."></textarea>
                          </div>`;

const newFieldsHtml = `                          <div class="mb-4">
                              <label class="block font-bold text-gray-700 mb-2">Avaliação Interna (Constatação do Problema) *</label>
                              <textarea id="satg-modal-observacao" rows="3" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-none mb-4" placeholder="Escreva a avaliação técnica aqui..."></textarea>
                              
                              <label class="block font-bold text-gray-700 mb-2">Solução do Problema (Ação Peças)</label>
                              <textarea id="satg-modal-acao-pecas" rows="2" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-none" placeholder="Ex: Encaminhado para o parceiro / Peça de reposição enviada..."></textarea>
                          </div>`;

// Regex or exact match using string
let target = `                          <div class="mb-4">
                              <label class="block font-bold text-gray-700 mb-2">Avaliao Interna (Constatao do Problema) *</label>
                              <textarea id="satg-modal-observacao" rows="4" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-none" placeholder="Escreva a avaliao tcnica aqui..."></textarea>
                          </div>`;

// Find by ID because of encoding issues
let parts = html.split('<textarea id="satg-modal-observacao"');
if(parts.length > 1) {
    let before = parts[0];
    let after = parts[1];
    let endDiv = after.indexOf('</div>');
    
    // We will just replace the whole div
    let blockStart = html.lastIndexOf('<div class="mb-4"', before.length);
    let blockEnd = before.length + endDiv + 6;
    
    let originalBlock = html.substring(blockStart, blockEnd);
    
    // Create new block
    let injected = `                          <div class="mb-4">
                              <label class="block font-bold text-gray-700 mb-2">Avaliação Interna (Constatação do Problema) *</label>
                              <textarea id="satg-modal-observacao" rows="3" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-none mb-4" placeholder="Escreva a avaliação técnica aqui..."></textarea>
                              
                              <label class="block font-bold text-gray-700 mb-2">Solução do Problema (Ação Peças)</label>
                              <textarea id="satg-modal-acao-pecas" rows="2" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-none" placeholder="Ex: Encaminhado para o parceiro / Será enviada a peça para substituição..."></textarea>
                          </div>`;
                          
    html = html.substring(0, blockStart) + injected + html.substring(blockEnd);
    fs.writeFileSync('index.html', html);
    console.log('HTML updated with Solucao do Problema');
} else {
    console.log('Failed to find textarea');
}
