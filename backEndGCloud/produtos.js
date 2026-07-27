const express = require('express');

// Utilitário para delay (Rate Limit Bling: 3 req/s)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


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

            const fetchWithRetry = async (apiCall, retries = 3) => {
                for (let i = 0; i < retries; i++) {
                    try {
                        return await apiCall();
                    } catch (error) {
                        if (i === retries - 1) throw error;
                        console.warn(`[Google Sheets] Falha temporária (${error.message}). Tentativa ${i + 1}/${retries}... aguardando 2s`);
                        await sleep(2000);
                    }
                }
            };

            // --- PASSO 2: PROCESSAR A ABA 'PRODUTOS' ---
            // Lê os cabeçalhos (Linha 4, Colunas B até BH)
            const headersResponse = await fetchWithRetry(() => sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetNameProdutos}'!B4:BH4`,
            }));
            const headers = headersResponse.data.values[0];

            // Lê os dados (Linha 5 até o fim, Colunas B até BH)
            const dataResponse = await fetchWithRetry(() => sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetNameProdutos}'!B5:BH`,
                valueRenderOption: 'FORMATTED_VALUE',
            }));
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
                        case 'imagem':
                        case 'imagens':
                        case 'url_imagem':
                        case 'url_imagens':
                        case 'url_do_produto_imagens':
                            const rawValue = String(value || '').trim();
                            // Suporta tanto pipe (|) quanto vírgula (,) como delimitadores
                            const urls = rawValue.split(/[|,]/).map(item => item.trim()).filter(item => item && item.startsWith('http'));
                            productObject['url_imagens_externas'] = urls;
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
     * Rota para buscar um único produto no Bling.
     * GET /:id
     */
    router.get('/:id', async (req, res, next) => {
        const idProduto = req.params.id;
        try {
            const tokenResponse = await axios.get(tokenUrl);
            const accessToken = tokenResponse.data.access_token;
            if (!accessToken) throw new Error("Não foi possível obter o token do Bling.");

            const getBlingUrl = `${blingBaseUrl}/produtos/${idProduto}`;
            const getBlingRes = await axios.get(getBlingUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            res.status(200).json(getBlingRes.data);
        } catch (error) {
            console.error(`Erro ao buscar produto ${idProduto}:`, error.message);
            res.status(500).json({ error: "Erro ao buscar produto." });
        }
    });

    /**
     * Rota para atualizar o nome (descrição) ou a localização de um produto.
     * PUT /:id
     */
    router.put('/:id', async (req, res, next) => {
        const idProduto = req.params.id;
        const { nome, localizacao, codigo, preco_de_custo, preco, grupo_tag_id, imagem_url, peso_bruto, peso_liquido } = req.body;

    // Mapa fixo dos IDs de tags para labels legíveis
    // Mapa fixo dos IDs reais de camposCustomizados para labels legíveis (com acentuação correspondente à planilha)
    const TAG_LABELS = {
        296703145: 'Estoque - Consumo',
        295570389: 'Estoque - Fábrica',
        295570388: 'Estoque - Terceiros',
        295570391: 'Serviço',
        295570390: 'Sob Demanda - Fábrica',
    };
    const novoGrupoLabel = grupo_tag_id ? (TAG_LABELS[parseInt(grupo_tag_id)] || '') : null;

        console.log(`--- ATUALIZANDO PRODUTO: ID ${idProduto} ---`);
        if (nome) console.log(` > Novo Nome: ${nome}`);
        if (localizacao !== undefined) console.log(` > Nova Localização: ${localizacao}`);
        if (imagem_url) console.log(` > Nova Imagem URL: ${imagem_url}`);

        if (!nome && localizacao === undefined && !codigo && preco_de_custo === undefined && preco === undefined && grupo_tag_id === undefined && imagem_url === undefined && peso_bruto === undefined && peso_liquido === undefined) {
            return res.status(400).json({ error: "Nenhum campo para atualizar foi informado." });
        }

        try {
            // 1. Obter Token do Bling
            const tokenResponse = await axios.get(tokenUrl);
            const accessToken = tokenResponse.data.access_token;

            if (!accessToken) {
                throw new Error("Não foi possível obter o token do Bling.");
            }

            // 2. Buscar dados atuais do produto no Bling (trazendo camposCustomizados para não perdê-los no PUT)
            console.log(`[Bling] Buscando dados atuais completos do produto ID ${idProduto}...`);
            const getBlingUrl = `${blingBaseUrl}/produtos/${idProduto}?campos=camposCustomizados`;
            const getBlingRes = await axios.get(getBlingUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            const currentProduct = getBlingRes.data.data;
            if (!currentProduct) {
                throw new Error("Produto não encontrado no Bling para atualização.");
            }
            console.log(`[Bling] Dados atuais do produto:`, JSON.stringify(currentProduct, null, 2));

            // 3. Montar o Payload de atualização clonando o produto atual e alterando apenas o necessário
            // Removemos campos que não devem ser enviados no corpo de um PUT (como IDs internos e timestamps)
            const { id, dataCriacao, dataAlteracao, ...productData } = currentProduct;

            const blingUrl = `${blingBaseUrl}/produtos/${idProduto}`;
            const blingPayload = {
                ...productData,
                nome: nome || currentProduct.nome,
                codigo: codigo || currentProduct.codigo,
                precoCusto: preco_de_custo !== undefined ? parseFloat(preco_de_custo) : currentProduct.precoCusto,
                preco: preco !== undefined ? parseFloat(preco) : currentProduct.preco,
                pesoBruto: peso_bruto !== undefined ? parseFloat(peso_bruto) : currentProduct.pesoBruto,
                pesoLiquido: peso_liquido !== undefined ? parseFloat(peso_liquido) : currentProduct.pesoLiquido
            };

            // REMOÇÃO CRÍTICA: O Bling V3 apaga as imagens se enviarmos o objeto 'midia' de volta no PUT
            // sem que seja um formato específico de upload.
            // Se o usuário enviou uma imagem_url nova, nós a adicionamos na estrutura exigida pelo Bling.
            // Caso contrário, removemos o campo para preservar as imagens atuais.
            if (imagem_url) {
                const links = imagem_url.split(/[|,]/).map(url => url.trim()).filter(url => url.startsWith('http'));
                if (links.length > 0) {
                    blingPayload.midia = {
                        imagens: {
                            imagensURL: links.map(link => ({ link: link }))
                        }
                    };
                    console.log(`[Bling] Adicionando NOVA midia ao payload:`, JSON.stringify(blingPayload.midia));
                } else if (blingPayload.midia) {
                    delete blingPayload.midia;
                }
            } else if (blingPayload.midia && blingPayload.midia.imagens) {
                // PRESERVAÇÃO DE IMAGENS: Se não enviamos imagem_url, queremos manter as originais.
                // O Bling V3 exige que passemos as URLs originais no 'imagensURL' no PUT,
                // caso contrário ele apagará as imagens existentes se enviarmos formato errado ou não enviarmos nada.
                const existingLinks = [];
                if (blingPayload.midia.imagens.externas) {
                    existingLinks.push(...blingPayload.midia.imagens.externas.map(img => img.link));
                }
                if (blingPayload.midia.imagens.internas) {
                    existingLinks.push(...blingPayload.midia.imagens.internas.map(img => img.linkOriginal || img.linkMiniatura || img.link));
                }
                
                const validLinks = existingLinks.filter(url => url && url.startsWith('http'));
                
                if (validLinks.length > 0) {
                    blingPayload.midia = {
                        imagens: {
                            imagensURL: validLinks.map(link => ({ link }))
                        }
                    };
                    console.log(`[Bling] Preservando midia existente no payload:`, JSON.stringify(blingPayload.midia));
                } else {
                    delete blingPayload.midia;
                }
            } else {
                delete blingPayload.midia;
            }

            const productCode = codigo || currentProduct.codigo || '';
            const isService = String(productCode).startsWith('7');

            // NOVO: Se grupo de tag foi informado, inclui no payload via camposCustomizados (ID do campo: 3221745)
            // Apenas para produtos normais (código não inicia com '7'), pois serviços não possuem esse campo customizado no Bling.
            if (grupo_tag_id !== undefined && !isService) {
                const customFields = productData.camposCustomizados || [];
                const fieldIndex = customFields.findIndex(cf => cf.idCampoCustomizado === 3221745);
                const newFieldValue = grupo_tag_id ? String(grupo_tag_id) : "0";
                
                if (fieldIndex !== -1) {
                    customFields[fieldIndex].valor = newFieldValue;
                } else {
                    customFields.push({
                        idCampoCustomizado: 3221745,
                        valor: newFieldValue
                    });
                }
                blingPayload.camposCustomizados = customFields;
            } else if (isService) {
                // Remove campos customizados para evitar problemas na atualização do Bling
                delete blingPayload.camposCustomizados;
            }

            // NOVO: Passo 3.1 - Obter o vínculo do fornecedor
            // Em Bling V3, o fornecedor principal costuma vir no campo singular 'fornecedor'
            let fornecedorVinculo = null;
            if (currentProduct.fornecedor && currentProduct.fornecedor.id) {
                fornecedorVinculo = currentProduct.fornecedor;
                console.log(`[Bling] Vínculo de fornecedor detectado no produto: ID ${fornecedorVinculo.id}`);
            }

            // NOVO: Passo 3.2 - Atualizar o preço no fornecedor via rota específica
            // PUT /produtos/fornecedores/{idProdutoFornecedor}
            if (preco_de_custo !== undefined && fornecedorVinculo) {
                try {
                    // Rate Limit: Espera um pouco antes de chamar a próxima API do Bling
                    await sleep(500);
                    
                    const supplierUrl = `${blingBaseUrl}/produtos/fornecedores/${fornecedorVinculo.id}`;
                    console.log(`[Bling] Atualizando preço no fornecedor (ID Vínculo: ${fornecedorVinculo.id}) via ${supplierUrl}...`);
                    
                    // O Bling V3 exige IDs de produto e contato para validar a edição do item do fornecedor
                    const supplierPayload = {
                        id: fornecedorVinculo.id,
                        precoCusto: parseFloat(preco_de_custo),
                        produto: { id: parseInt(idProduto) },
                        fornecedor: { id: fornecedorVinculo.contato?.id || 0 }
                    };
                    
                    console.log(`[Bling] Payload do fornecedor:`, JSON.stringify(supplierPayload, null, 2));
                    
                    await axios.put(supplierUrl, supplierPayload, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    console.log(`[Bling] Sucesso na atualização do fornecedor vínculo ${fornecedorVinculo.id}`);
                } catch (err) {
                    console.error(`[Bling] Erro ao atualizar fornecedor vínculo:`, err.response?.data || err.message);
                }
            }

            // Rate Limit: Espera meio segundo antes da atualização principal do produto
            await sleep(500);

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
            
            const getColIndices = (predicate) => {
                const indices = [];
                normalizedHeaders.forEach((h, i) => {
                    if (predicate(h)) indices.push(i);
                });
                return indices;
            };

            const idColIndex = normalizedHeaders.indexOf('id');
            const descricaoColIndices = getColIndices(h => h === 'descricao');
            const localizacaoColIndices = getColIndices(h => h === 'localizacao');
            const codigoColIndices = getColIndices(h => h === 'codigo');
            const precoCustoColIndices = getColIndices(h => h === 'preco_de_custo');
            const precoColIndices = getColIndices(h => h === 'preco');
            const grupoTagsColIndices = getColIndices(h => h === 'grupo_de_tags_tags');
            const imagemUrlColIndices = getColIndices(h => h.includes('imagem') || h.includes('imagens') || h.includes('url_formatada') || h.includes('midia'));
            const pesoBrutoColIndices = getColIndices(h => h === 'peso_bruto');
            const pesoLiquidoColIndices = getColIndices(h => h === 'peso_liquido');

            if (idColIndex === -1) {
                throw new Error("Coluna 'ID' não encontrada na planilha.");
            }

            // Converte índice do array (base-0, partindo da coluna B) para letra A1 do Sheets
            // String.fromCharCode só funciona até Z; esta função suporta AA, AB, AI, etc.
            const colToA1 = (i) => {
                let num = i + 2; // +2 porque o array começa na coluna B (coluna 2)
                let letter = '';
                while (num > 0) {
                    const rem = (num - 1) % 26;
                    letter = String.fromCharCode(65 + rem) + letter;
                    num = Math.floor((num - 1) / 26);
                }
                return letter;
            };

            // Lê a coluna de IDs para encontrar a linha
            const rangeIds = `'${sheetNameProdutos}'!${colToA1(idColIndex)}5:${colToA1(idColIndex)}`;
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
                if (nome && descricaoColIndices.length > 0) {
                    for (let colIdx of descricaoColIndices) {
                        const updateDescRange = `'${sheetNameProdutos}'!${colToA1(colIdx)}${rowIndex}`;
                        console.log(`[Sheets] Atualizando descrição na linha ${rowIndex}, coluna ${colToA1(colIdx)}`);
                        await sheets.spreadsheets.values.update({
                            spreadsheetId, range: updateDescRange, valueInputOption: 'RAW', resource: { values: [[nome]] }
                        });
                    }
                }

                // Atualiza Localização se houver
                if (localizacao !== undefined && localizacaoColIndices.length > 0) {
                    for (let colIdx of localizacaoColIndices) {
                        const updateLocRange = `'${sheetNameProdutos}'!${colToA1(colIdx)}${rowIndex}`;
                        console.log(`[Sheets] Atualizando localização na linha ${rowIndex}, coluna ${colToA1(colIdx)}`);
                        await sheets.spreadsheets.values.update({
                            spreadsheetId, range: updateLocRange, valueInputOption: 'RAW', resource: { values: [[localizacao]] }
                        });
                    }
                }

                // Atualiza Imagem URL se houver
                if (imagem_url !== undefined && imagemUrlColIndices.length > 0) {
                    for (let colIdx of imagemUrlColIndices) {
                        const updateImgRange = `'${sheetNameProdutos}'!${colToA1(colIdx)}${rowIndex}`;
                        console.log(`[Sheets] Atualizando url da imagem na linha ${rowIndex}, coluna ${colToA1(colIdx)}`);
                        await sheets.spreadsheets.values.update({
                            spreadsheetId, range: updateImgRange, valueInputOption: 'RAW', resource: { values: [[imagem_url]] }
                        });
                    }
                }

                // NOVO: Atualiza Código se houver
                if (codigo && codigoColIndices.length > 0) {
                    for (let colIdx of codigoColIndices) {
                        const updateCodeRange = `'${sheetNameProdutos}'!${colToA1(colIdx)}${rowIndex}`;
                        console.log(`[Sheets] Atualizando código na linha ${rowIndex}, coluna ${colToA1(colIdx)}`);
                        await sheets.spreadsheets.values.update({
                            spreadsheetId, range: updateCodeRange, valueInputOption: 'RAW', resource: { values: [[codigo]] }
                        });
                    }
                }

                // NOVO: Atualiza Preço de Custo se houver
                if (preco_de_custo !== undefined && precoCustoColIndices.length > 0) {
                    for (let colIdx of precoCustoColIndices) {
                        const updatePriceRange = `'${sheetNameProdutos}'!${colToA1(colIdx)}${rowIndex}`;
                        console.log(`[Sheets] Atualizando preço de custo na linha ${rowIndex}, coluna ${colToA1(colIdx)}`);
                        // Formata como número para que a planilha possa aplicar formatação de moeda
                        await sheets.spreadsheets.values.update({
                            spreadsheetId, range: updatePriceRange, valueInputOption: 'USER_ENTERED', resource: { values: [[preco_de_custo]] }
                        });
                    }
                }

                // NOVO: Atualiza Preço de Venda se houver
                if (preco !== undefined && precoColIndices.length > 0) {
                    for (let colIdx of precoColIndices) {
                        const updatePriceSaleRange = `'${sheetNameProdutos}'!${colToA1(colIdx)}${rowIndex}`;
                        console.log(`[Sheets] Atualizando preço na linha ${rowIndex}, coluna ${colToA1(colIdx)}`);
                        await sheets.spreadsheets.values.update({
                            spreadsheetId, range: updatePriceSaleRange, valueInputOption: 'USER_ENTERED', resource: { values: [[preco]] }
                        });
                    }
                }
                
                // NOVO: Atualiza Grupo de Tags se houver
                if (grupo_tag_id !== undefined && grupoTagsColIndices.length > 0) {
                    for (let colIdx of grupoTagsColIndices) {
                        const updateTagRange = `'${sheetNameProdutos}'!${colToA1(colIdx)}${rowIndex}`;
                        console.log(`[Sheets] Atualizando grupo de tags na linha ${rowIndex}, coluna ${colToA1(colIdx)}: ${novoGrupoLabel}`);
                        await sheets.spreadsheets.values.update({
                            spreadsheetId, range: updateTagRange, valueInputOption: 'RAW', resource: { values: [[novoGrupoLabel || '']] }
                        });
                    }
                }

                // NOVO: Atualiza Peso Bruto se houver
                if (peso_bruto !== undefined && pesoBrutoColIndices.length > 0) {
                    for (let colIdx of pesoBrutoColIndices) {
                        const updateWeightRange = `'${sheetNameProdutos}'!${colToA1(colIdx)}${rowIndex}`;
                        console.log(`[Sheets] Atualizando peso_bruto na linha ${rowIndex}, coluna ${colToA1(colIdx)}`);
                        await sheets.spreadsheets.values.update({
                            spreadsheetId, range: updateWeightRange, valueInputOption: 'USER_ENTERED', resource: { values: [[peso_bruto]] }
                        });
                    }
                }

                // NOVO: Atualiza Peso Liquido se houver
                if (peso_liquido !== undefined && pesoLiquidoColIndices.length > 0) {
                    for (let colIdx of pesoLiquidoColIndices) {
                        const updateWeightRange = `'${sheetNameProdutos}'!${colToA1(colIdx)}${rowIndex}`;
                        console.log(`[Sheets] Atualizando peso_liquido na linha ${rowIndex}, coluna ${colToA1(colIdx)}`);
                        await sheets.spreadsheets.values.update({
                            spreadsheetId, range: updateWeightRange, valueInputOption: 'USER_ENTERED', resource: { values: [[peso_liquido]] }
                        });
                    }
                }
            } else {
                console.warn(`[Sheets] Produto ID ${idProduto} não encontrado na planilha para atualização.`);
            }

            // 5. Notificar via Firestore Sync
            if (notifySync) {
                console.log(`[Firestore Sync] Notificando atualização de produto: ${codigo || idProduto}`);
                const syncPayload = {
                    id: idProduto,
                    codigo: codigo || currentProduct.codigo || null,
                    novoNome: nome || currentProduct.nome || null,
                    novaLocalizacao: localizacao !== undefined ? localizacao : (currentProduct.estoque?.localizacao ?? null),
                    novoPrecoCusto: preco_de_custo !== undefined ? preco_de_custo : (currentProduct.precoCusto ?? currentProduct.fornecedor?.precoCusto ?? null),
                    novoPreco: preco !== undefined ? preco : (currentProduct.preco ?? null),
                    novoPesoBruto: peso_bruto !== undefined ? peso_bruto : (currentProduct.pesoBruto ?? null),
                    novoPesoLiquido: peso_liquido !== undefined ? peso_liquido : (currentProduct.pesoLiquido ?? null)
                };
                
                if (grupo_tag_id !== undefined) {
                    syncPayload.novoGrupoTags = novoGrupoLabel ?? null;
                }

                await notifySync('productUpdated', syncPayload);
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