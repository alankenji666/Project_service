const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<tbody id="garantia-items-list" class="divide-y divide-gray-100">\s*<tr>\s*<td colspan="5" id="garantia-items-empty" class="px-4 py-8 text-sm text-gray-500 italic text-center">Nenhum item adicionado\.<\/td>\s*<\/tr>\s*<\/tbody>/;

const replacement = `<tbody id="garantia-items-list" class="divide-y divide-gray-100">
                                        <tr>
                                            <td colspan="5" id="garantia-items-empty" class="px-4 py-8 text-sm text-gray-500 italic text-center">Nenhum item adicionado.</td>
                                        </tr>
                                    </tbody>
                                    <tfoot id="garantia-items-footer" class="border-t border-gray-200 hidden">
                                    </tfoot>`;

if (regex.test(html)) {
    html = html.replace(regex, replacement);
    fs.writeFileSync('index.html', html);
    console.log('tfoot added using regex!');
} else {
    console.log('regex did not match!');
}
