const { google } = require('googleapis');
const axios = require('axios');

// --- Configurações (Copiado do index.js) ---
const SPREADSHEET_ID_NFE = '1W3pziTxiwV7In4_DyD1AJE16sEBJUGgA5mmczylutcg';
const SHEET_NAME_PEDIDOS_BLING = 'PedidosBling';
const APPS_SCRIPT_TOKEN_URL = 'https://script.google.com/macros/s/AKfycbx3XhYP5umik9nmioPFAxhjYDGVt3JGQKG5CurojqAAlQP1SavvzOPJGxu_Ii0kQ9vE/exec';
const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';

const COLUMNS = {
    CONFERIDO: 0,
    ID: 1,
    NUMERO: 2,
    NUMERO_LOJA: 3,
    DATA: 4,
    DATA_SAIDA: 5,
    SITUACAO: 6,
    CONTATO_NOME: 7,
    CPF_CNPJ: 8,
    TOTAL_PRODUTOS: 9,
    TOTAL_PEDIDO: 10,
    VENDEDOR: 11,
    LOJA: 12,
    ID_NOTA: 13,
    OBSERVACAO: 14,
    ITENS: 15
};

function traduzirSituacaoPedido(id) {
    const s = {
        6: "Em aberto",
        9: "Atendido",
        12: "Cancelado",
        15: "Em andamento",
        18: "Venda agenciada",
        21: "Para entregar",
        24: "Em digitação",
        27: "Verificado"
    };
    return s[id] || "ID: " + id;
}

async function runRecovery() {
    console.log('--- [SCRIPT DE RECUPERAÇÃO] INICIANDO ---');
    
    try {
        // 1. Auth Google
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const authClient = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        
        // 2. Obter Token Bling
        console.log('[1/4] Obtendo token do Bling...');
        const tokenRes = await axios.get(APPS_SCRIPT_TOKEN_URL);
        const token = tokenRes.data.access_token;
        
        // 3. Ler Planilha
        console.log('[2/4] Lendo planilha PedidosBling...');
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID_NFE,
            range: `${SHEET_NAME_PEDIDOS_BLING}!A:P`
        });
        const rows = response.data.values || [];
        
        const errorsToProcess = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const situacao = row[COLUMNS.SITUACAO] || "";
            if (situacao === "Não encontrado") {
                errorsToProcess.push({
                    rowIndex: i + 1,
                    pedidoId: row[COLUMNS.ID],
                    dadosManuais: {
                        conferido: row[COLUMNS.CONFERIDO] || "",
                        observacao: row[COLUMNS.OBSERVACAO] || ""
                    }
                });
            }
        }
        
        console.log(`[3/4] Encontrados ${errorsToProcess.length} pedidos para recuperar.`);
        
        // 4. Processar cada erro
        for (const item of errorsToProcess) {
            console.log(`Recuperando pedido ID: ${item.pedidoId} (Linha ${item.rowIndex})...`);
            
            try {
                const blingRes = await axios.get(`${BLING_API_BASE_URL}/pedidos/vendas/${item.pedidoId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const p = blingRes.data.data;
                
                if (!p) {
                    console.warn(`Pedido ${item.pedidoId} não retornado pelo Bling.`);
                    continue;
                }
                
                // Mapear dados (Lógica identica ao webhook)
                let origemLoja = "";
                let vendedorFinal = p.vendedor ? (p.vendedor.contato ? p.vendedor.contato.nome : (p.vendedor.nome || "ID: " + p.vendedor.id)) : "";
                let lojaIdTratado = String(p.loja ? p.loja.id : "0").trim();
                switch (lojaIdTratado) {
                    case '0': origemLoja = "Bling"; break;
                    case '205408073': origemLoja = "Mercado Livre"; break;
                    case '205371925': origemLoja = "Loja Integrada"; break;
                    default: origemLoja = lojaIdTratado; break;
                }
                if (origemLoja === "Loja Integrada") vendedorFinal = "E-Commerce";

                const rowValues = new Array(16).fill('');
                rowValues[COLUMNS.CONFERIDO] = item.dadosManuais.conferido;
                rowValues[COLUMNS.ID] = String(p.id);
                rowValues[COLUMNS.NUMERO] = p.numero || "";
                rowValues[COLUMNS.NUMERO_LOJA] = p.numeroLoja || "";
                rowValues[COLUMNS.DATA] = p.data || "";
                rowValues[COLUMNS.DATA_SAIDA] = p.dataSaida || "";
                rowValues[COLUMNS.SITUACAO] = p.situacao ? traduzirSituacaoPedido(p.situacao.id) : "N/A";
                rowValues[COLUMNS.CONTATO_NOME] = p.contato ? p.contato.nome : "N/A";
                rowValues[COLUMNS.CPF_CNPJ] = p.contato ? (p.contato.numeroDocumento || "") : "";
                rowValues[COLUMNS.TOTAL_PRODUTOS] = p.totalProdutos || 0;
                rowValues[COLUMNS.TOTAL_PEDIDO] = p.total || 0;
                rowValues[COLUMNS.VENDEDOR] = vendedorFinal;
                rowValues[COLUMNS.LOJA] = origemLoja;
                rowValues[COLUMNS.ID_NOTA] = p.notaFiscal ? (p.notaFiscal.id || "") : "";
                rowValues[COLUMNS.OBSERVACAO] = item.dadosManuais.observacao;
                if (p.itens && Array.isArray(p.itens)) {
                    rowValues[COLUMNS.ITENS] = p.itens.map(it => `(${it.codigo}, ${parseFloat(it.quantidade).toFixed(2)}, ${parseFloat(it.valor).toFixed(2)})`).join(' ');
                }

                // Salvar na Planilha
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID_NFE,
                    range: `${SHEET_NAME_PEDIDOS_BLING}!A${item.rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [rowValues] }
                });
                
                console.log(`[OK] Pedido ${item.pedidoId} recuperado com sucesso.`);
                
                // Esperar um pouco para evitar limites
                await new Promise(r => setTimeout(r, 300));
                
            } catch (innerError) {
                console.error(`Erro ao recuperar pedido ${item.pedidoId}:`, innerError.message);
            }
        }
        
        console.log('--- [SCRIPT DE RECUPERAÇÃO] CONCLUÍDO ---');
        
    } catch (error) {
        console.error('Erro crítico no script de recuperação:', error.message);
    }
}

runRecovery();
