const express = require('express');

/**
 * Cria um roteador para buscar e processar os dados dos produtos.
 * @param {Function} getSheetsClient - Função para obter o cliente autenticado do Google Sheets.
 * @param {string} spreadsheetId - ID da planilha que contém as abas de produtos.
 * @param {string} sheetNameProdutos - Nome da aba principal de produtos (ex: 'Produtos').
 * @param {string} sheetNameEstoque - Nome da aba com dados de vendas (ex: 'Produtos Estoque').
 * @returns {object} O roteador Express.
 */
const createProdutosRouter = (getSheetsClient, spreadsheetId, sheetNameProdutos, sheetNameEstoque) => {
    const router = express.Router();

    /**
     * Normaliza uma string de cabeçalho para ser uma chave JSON válida, limpa e padronizada.
     * @param {string} text O texto do cabeçalho.
     * @returns {string} A chave normalizada em minúsculas e sem caracteres especiais.
     */
    const normalizeKey = (text) => {
        if (!text) return '';
        return text
            .toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .toLowerCase()
            .replace(/\(.*\)/g, '') // Remove texto entre parênteses
            .replace(/[^a-z0-9]/g, '_') // Substitui caracteres não alfanuméricos por underscore
            .replace(/_+/g, '_') // Substitui múltiplos underscores por um único
            .replace(/^_+|_+$/g, ''); // Remove underscores do início e do fim
    };

    /**
     * Rota principal que replica a lógica do Apps Script.
     * GET /
     * Retorna o JSON processado dos produtos.
     */
    router.get('/', async (req, res, next) => {
        console.log('--- INICIANDO A GERAÇÃO DO JSON DE PRODUTOS (via API Cloud) ---');
        try {
            const sheets = await getSheetsClient();
            
            // --- PASSO 1: LER OS DADOS DA ABA 'PRODUTOS ESTOQUE' E CRIAR UM MAPA DE VENDAS ---
            const vendasMap = {};
            let estoqueData;
            try {
                const estoqueResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: `'${sheetNameEstoque}'!B9:I`, 
                });
                estoqueData = estoqueResponse.data.values;
            } catch (e) {
                console.warn(`AVISO: Não foi possível ler a aba "${sheetNameEstoque}". ${e.message}`);
                estoqueData = [];
            }

            if (estoqueData && estoqueData.length > 0) {
                estoqueData.forEach(row => {
                    const codigo = String(row[0] || '').trim();
                    const vendas30dias = parseInt(row[5]) || 0;
                    const vendas90dias = parseInt(row[6]) || 0;
                    const vendasMesAtual = parseInt(row[7]) || 0;
                    
                    if (codigo) {
                        vendasMap[codigo] = {
                            vendas_ultimos_30_dias: vendas30dias,
                            vendas_ultimos_90_dias: vendas90dias,
                            vendas_mes_atual: vendasMesAtual
                        };
                    }
                });
                console.log(`${Object.keys(vendasMap).length} produtos mapeados com dados de vendas.`);
            }

            // --- PASSO 2: PROCESSAR A ABA 'PRODUTOS' ---
            // Lê os cabeçalhos (Linha 4, Colunas B até BH)
            const headersResponse = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetNameProdutos}'!B4:BH4`,
            });
            const headers = headersResponse.data.values[0];

            // Lê os dados (Linha 5 até o fim, Colunas B até BH)
            const dataResponse = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetNameProdutos}'!B5:BH`,
                valueRenderOption: 'FORMATTED_VALUE',
            });
            const data = dataResponse.data.values;

            if (!data || data.length === 0) {
                console.log("A lista de produtos está vazia.");
                return res.status(200).json({
                    data: [],
                    message: "A lista de produtos está vazia ou não foi encontrada na aba 'Produtos'."
                });
            }

            const keys = headers.map(header => normalizeKey(header));
            console.log(`${data.length} linhas de produtos para processar.`);

            const productsArray = data.map((row) => {
                let productObject = {};
                keys.forEach((key, i) => {
                    let value = row[i];

                    switch (key) {
                        case 'preco':
                        case 'valor_ipi_fixo':
                        case 'preco_de_custo':
                        case 'preco_de_compra':
                        case 'valor_base_icms_st_para_retencao':
                        case 'valor_icms_st_para_retencao':
                        case 'valor_icms_proprio_do_substituto':
                            let priceString = String(value || '').replace("R$", "").trim();
                            priceString = priceString.replace(/\./g, '').replace(',', '.');
                            productObject[key] = parseFloat(priceString) || null;
                            break;
                        case 'estoque':
                        case 'estoque_maximo':
                        case 'estoque_minimo':
                        case 'itens_p_caixa':
                        case 'volumes':
                        case 'cross_docking':
                        case 'meses_garantia_no_fornecedor':
                        case 'largura_do_produto':
                        case 'altura_do_produto':
                        case 'profundidade_do_produto':
                        case 'peso_liquido':
                        case 'peso_bruto':
                            let numStr = String(value || '').replace(',', '.');
                            productObject[key] = parseFloat(numStr) || null;
                            break;
                        case 'situacao':
                            productObject[key] = (String(value || '').toLowerCase().trim() === 'ativo');
                            break;
                        case 'frete_gratis':
                            productObject[key] = (String(value || '').toLowerCase().trim() === 'sim');
                            break;
                        case 'url_imagens_externas':
                            productObject[key] = String(value || '').split('|').map(item => item.trim()).filter(item => item);
                            break;
                        case 'grupo_de_tags_tags':
                            const rawTags = String(value || '').trim();
                            let processedTags = [];
                            if (rawTags !== '') {
                                processedTags = rawTags.split(',').map(item => item.trim()).filter(item => item !== '');
                            }
                            productObject[key] = processedTags.length > 0 ? processedTags : null;
                            break;
                        default:
                            productObject[key] = (value === '' || value === null || value === undefined) ? null : String(value).trim();
                            break;
                    }
                });

                const productCode = productObject.codigo;
                if (productCode && vendasMap[productCode]) {
                    productObject.vendas_ultimos_30_dias = vendasMap[productCode].vendas_ultimos_30_dias;
                    productObject.vendas_ultimos_90_dias = vendasMap[productCode].vendas_ultimos_90_dias;
                    productObject.vendas_mes_atual = vendasMap[productCode].vendas_mes_atual;
                } else {
                    productObject.vendas_ultimos_30_dias = null;
                    productObject.vendas_ultimos_90_dias = null;
                    productObject.vendas_mes_atual = null;
                }

                const dimensions = {
                    largura: productObject.largura_do_produto || null,
                    altura: productObject.altura_do_produto || null,
                    profundidade: productObject.profundidade_do_produto || null,
                    peso_bruto: productObject.peso_bruto || null,
                    peso_liquido: productObject.peso_liquido || null,
                };
                if (Object.values(dimensions).some(v => v !== null)) {
                    productObject.metricas = dimensions;
                }
                delete productObject.largura_do_produto;
                delete productObject.altura_do_produto;
                delete productObject.profundidade_do_produto;
                delete productObject.peso_bruto;
                delete productObject.peso_liquido;

                return productObject;
            });

            console.log(`Processamento concluído. ${productsArray.length} produtos serão retornados.`);
            res.status(200).json({ data: productsArray });

        } catch (error) {
            next(error);
        }
    });

    return router;
};

module.exports = createProdutosRouter;