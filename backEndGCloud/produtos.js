const express = require('express');

/**
 * Cria um roteador para buscar e processar os dados dos produtos.
 * @param {Function} getSheetsClient - Função para obter o cliente autenticado do Google Sheets.
 * @param {string} spreadsheetId - ID da planilha que contém as abas de produtos.
 * @param {string} sheetNameProdutos - Nome da aba principal de produtos (ex: 'Produtos').
 * @param {string} sheetNameEstoque - Nome da aba com dados de vendas (ex: 'Produtos Estoque').
 * @param {object} axios - Cliente HTTP para requisições externas.
 * @param {string} tokenUrl - URL para obter o token do Bling.
 * @param {string} blingBaseUrl - URL base da API do Bling.
 * @param {Function} notifySync - Função para notificação via Firestore Sync.
 * @returns {object} O roteador Express.
 */
const createProdutosRouter = (getSheetsClient, spreadsheetId, sheetNameProdutos, sheetNameEstoque, axios, tokenUrl, blingBaseUrl, notifySync) => {
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

    /**
     * Rota para atualizar o nome (descrição) ou a localização de um produto.
     * PUT /:id
     */
    router.put('/:id', async (req, res, next) => {
        const idProduto = req.params.id;
        const { nome, localizacao, codigo } = req.body;

        console.log(`--- ATUALIZANDO PRODUTO: ID ${idProduto} ---`);
        if (nome) console.log(` > Novo Nome: ${nome}`);
        if (localizacao !== undefined) console.log(` > Nova Localização: ${localizacao}`);

        if (!nome && localizacao === undefined && !codigo) {
            return res.status(400).json({ error: "Nome, localização ou código do produto deve ser informado." });
        }

        try {
            // 1. Obter Token do Bling
            const tokenResponse = await axios.get(tokenUrl);
            const accessToken = tokenResponse.data.access_token;

            if (!accessToken) {
                throw new Error("Não foi possível obter o token do Bling.");
            }

            // 2. Buscar dados atuais do produto no Bling
            console.log(`[Bling] Buscando dados atuais completos do produto ID ${idProduto}...`);
            const getBlingUrl = `${blingBaseUrl}/produtos/${idProduto}`;
            const getBlingRes = await axios.get(getBlingUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            const currentProduct = getBlingRes.data.data;
            if (!currentProduct) {
                throw new Error("Produto não encontrado no Bling para atualização.");
            }

            // 3. Montar o Payload de atualização clonando o produto atual e alterando apenas o necessário
            // Removemos campos que não devem ser enviados no corpo de um PUT (como IDs internos e timestamps)
            const { id, dataCriacao, dataAlteracao, ...productData } = currentProduct;

            const blingUrl = `${blingBaseUrl}/produtos/${idProduto}`;
            const blingPayload = {
                ...productData,
                nome: nome || currentProduct.nome,
                codigo: codigo || currentProduct.codigo
            };

            // Se localizacao foi informada, ela deve ir dentro de 'estoque'
            if (localizacao !== undefined) {
                if (!blingPayload.estoque) blingPayload.estoque = {};
                blingPayload.estoque.localizacao = localizacao;
            }

            console.log(`[Bling] Enviando atualização completa para ${blingUrl}...`);
            const blingResponse = await axios.put(blingUrl, blingPayload, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            console.log(`[Bling] SUCESSO! Resposta: ${blingResponse.status}`);

            // 4. Atualizar na Planilha do Google
            const sheets = await getSheetsClient();
            
            // Lê a aba 'Produtos' para encontrar a linha correta
            const rangeHeader = `'${sheetNameProdutos}'!B4:BH4`;
            const headerRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangeHeader });
            const headers = headerRes.data.values[0];
            const normalizedHeaders = headers.map(h => normalizeKey(h));
            
            const idColIndex = normalizedHeaders.indexOf('id');
            const descricaoColIndex = normalizedHeaders.indexOf('descricao');
            const localizacaoColIndex = normalizedHeaders.indexOf('localizacao');
            const codigoColIndex = normalizedHeaders.indexOf('codigo'); // NOVO: Mapeia a coluna de código

            if (idColIndex === -1) {
                throw new Error("Coluna 'ID' não encontrada na planilha.");
            }

            // Lê a coluna de IDs para encontrar a linha
            const rangeIds = `'${sheetNameProdutos}'!${String.fromCharCode(66 + idColIndex)}5:${String.fromCharCode(66 + idColIndex)}`;
            const idsRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangeIds });
            const ids = idsRes.data.values || [];
            
            let rowIndex = -1;
            for (let i = 0; i < ids.length; i++) {
                if (String(ids[i][0]) === String(idProduto)) {
                    rowIndex = i + 5; // +5 porque começa na linha 5
                    break;
                }
            }

            if (rowIndex !== -1) {
                // Atualiza Descrição se houver
                if (nome && descricaoColIndex !== -1) {
                    const updateDescRange = `'${sheetNameProdutos}'!${String.fromCharCode(66 + descricaoColIndex)}${rowIndex}`;
                    console.log(`[Sheets] Atualizando descrição na linha ${rowIndex}`);
                    await sheets.spreadsheets.values.update({
                        spreadsheetId, range: updateDescRange, valueInputOption: 'RAW', resource: { values: [[nome]] }
                    });
                }

                // Atualiza Localização se houver
                if (localizacao !== undefined && localizacaoColIndex !== -1) {
                    const updateLocRange = `'${sheetNameProdutos}'!${String.fromCharCode(66 + localizacaoColIndex)}${rowIndex}`;
                    console.log(`[Sheets] Atualizando localização na linha ${rowIndex}`);
                    await sheets.spreadsheets.values.update({
                        spreadsheetId, range: updateLocRange, valueInputOption: 'RAW', resource: { values: [[localizacao]] }
                    });
                }

                // NOVO: Atualiza Código se houver
                if (codigo && codigoColIndex !== -1) {
                    const updateCodeRange = `'${sheetNameProdutos}'!${String.fromCharCode(66 + codigoColIndex)}${rowIndex}`;
                    console.log(`[Sheets] Atualizando código na linha ${rowIndex}`);
                    await sheets.spreadsheets.values.update({
                        spreadsheetId, range: updateCodeRange, valueInputOption: 'RAW', resource: { values: [[codigo]] }
                    });
                }
            } else {
                console.warn(`[Sheets] Produto ID ${idProduto} não encontrado na planilha para atualização.`);
            }

            // 5. Notificar via Firestore Sync
            if (notifySync) {
                console.log(`[Firestore Sync] Notificando atualização de produto: ${codigo || idProduto}`);
                notifySync('productUpdated', {
                    id: idProduto,
                    codigo: codigo || currentProduct.codigo,
                    novoNome: nome || currentProduct.nome,
                    novaLocalizacao: localizacao !== undefined ? localizacao : currentProduct.estoque?.localizacao
                });
            }

            res.status(200).json({ 
                status: 'success', 
                message: 'Produto atualizado com sucesso no Bling e na planilha.',
                blingResponse: blingResponse.data 
            });

        } catch (error) {
            if (error.response && error.response.data) {
                console.error("[Bling] Erro detalhado da API:", JSON.stringify(error.response.data, null, 2));
                const errorMessage = error.response.data.error?.message || error.response.data.message || "Erro desconhecido na API do Bling.";
                const err = new Error(errorMessage);
                err.statusCode = error.response.status;
                return next(err);
            }
            console.error("Erro ao atualizar produto:", error.message);
            next(error);
        }
    });

    return router;
};

module.exports = createProdutosRouter;