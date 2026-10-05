const fs = require('fs');
let js = fs.readFileSync('js/modulos/gerenciarGarantia.js', 'utf8');

// Update CSS rules in both print and download functions globally
js = js.replace(/\.section \{ margin-bottom: 15px; \}/g, '.section { margin-bottom: 8px; }');
js = js.replace(/\.section-title \{ font-size: 13px; text-transform: uppercase; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 10px; \}/g, '.section-title { font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #eee; padding-bottom: 2px; margin-bottom: 6px; }');
js = js.replace(/\.grid \{ display: flex; flex-wrap: wrap; gap: 10px; \}/g, '.grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }');
js = js.replace(/\.field \{ flex: 1; min-width: auto; background: #f9f9f9; padding: 6px 10px; border-radius: 5px; \}/g, '.field { flex: 1; min-width: auto; background: #f9f9f9; padding: 4px 8px; border-radius: 5px; }');
js = js.replace(/\.field-label \{ font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 2px; display: block; font-weight: bold; \}/g, '.field-label { font-size: 9px; text-transform: uppercase; color: #888; margin-bottom: 0px; display: block; font-weight: bold; }');
js = js.replace(/\.field-value \{ font-size: 13px; font-weight: bold; \}/g, '.field-value { font-size: 12px; font-weight: bold; }');
js = js.replace(/\.problema-box \{ background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 5px; margin-top: 10px; \}/g, '.problema-box { background: #fef2f2; border: 1px solid #fecaca; padding: 8px; border-radius: 5px; margin-top: 6px; }');
js = js.replace(/\.problema-label \{ font-size: 10px; text-transform: uppercase; color: #dc2626; margin-bottom: 2px; display: block; font-weight: bold; \}/g, '.problema-label { font-size: 9px; text-transform: uppercase; color: #dc2626; margin-bottom: 0px; display: block; font-weight: bold; }');
js = js.replace(/margin-bottom: 15px;/g, 'margin-bottom: 6px;');

// Update the Embalagem wrapping
js = js.replace(/<div class="field" style="flex: 1;">\s*<span class="field-label">Embalagem \/ Vol<\/span>\s*<span class="field-value">\$\{emb\}\$\{vol\}<\/span>\s*<\/div>/g, `<div class="field" style="flex: 1.5; white-space: nowrap;">
                            <span class="field-label">Embalagem / Vol</span>
                            <span class="field-value" style="font-size: 11px;">\${emb}\${vol}</span>
                        </div>`);

// Optional: we can also adjust font-size of Endereço
js = js.replace(/<span class="field-value" style="font-size: 12px;">\$\{fullEndereco\}<\/span>/g, '<span class="field-value" style="font-size: 11px;">\${fullEndereco}</span>');

fs.writeFileSync('js/modulos/gerenciarGarantia.js', js);
console.log('CSS compactado e quebra de linha corrigida!');
