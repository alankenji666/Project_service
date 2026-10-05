const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const regex = /<button id="btn-ver-pedido-satg" class="hidden px-5 py-2 text-white font-bold bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md flex items-center gap-2">\s*<svg.*?>.*?<\/svg>\s*Ver Pedido\s*<\/button>/;

if (html.match(regex)) {
    html = html.replace(regex, (match) => {
        return match.replace('Ver Pedido', 'Ver Orçamento');
    });
    fs.writeFileSync('index.html', html);
    console.log('Botão alterado com regex preciso!');
} else {
    console.log('Regex não deu match, tentando substituição simples em Ver Pedido');
    // Fallback if formatting is slightly different
    const searchString = `</svg>
                                Ver Pedido
                            </button>
                            <button id="btn-aprovar-pedido-satg"`;
                            
    const replaceString = `</svg>
                                Ver Orçamento
                            </button>
                            <button id="btn-aprovar-pedido-satg"`;
                            
    if (html.includes(searchString)) {
        html = html.replace(searchString, replaceString);
        fs.writeFileSync('index.html', html);
        console.log('Botão alterado com substituição simples!');
    }
}
