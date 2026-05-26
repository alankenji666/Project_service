/**
 * Script para criar headers na aba "Transportadoras"
 * Usa as credenciais ADC já configuradas
 */
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '11EqlFOTNfCiCl-sVlTjNzAK7feWcMJH8VFfOAgUXRSo';
const SHEET_NAME = 'Transportadoras';

const HEADERS = [
    'Codigo',
    'Nome',
    'Fantasia',
    'Endereco',
    'Numero',
    'Complemento',
    'Bairro',
    'Cidade',
    'Estado',
    'CEP',
    'CNPJ',
    'Inscricao_Estadual',
    'Telefone',
    'Email',
    'Website',
    'Contato',
    'Tipo',
    'Ativo',
    'Data_Inclusao',
    'Faz_Coleta'
];

async function setupHeaders() {
    try {
        // Usar Application Default Credentials (ADC)
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        console.log('📝 Criando headers na aba "Transportadoras"...');
        console.log('Colunas:', HEADERS);

        // Atualizar primeira linha com headers
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1`,
            valueInputOption: 'RAW',
            resource: {
                values: [HEADERS]
            }
        });

        console.log('✅ Headers criados com sucesso!');
        console.log(`📊 Planilha: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/`);
        console.log(`📄 Aba: ${SHEET_NAME}`);

        // Adicionar uma linha de exemplo (opcional)
        const exampleRow = [
            '001',
            'TRANSPEROLA TRANSPORTES RODOVIARIOS LTDA',
            'TRANSPEROLA',
            'AVENIDA PAPA JOAO PAULO I',
            '1735',
            '',
            'VILA AEROPORTO',
            'Guarulhos',
            'SP',
            '07170-350',
            '44.433.407/0001-88',
            '',
            '(11) 2431-5651',
            'fabiano@transperola.com.br',
            'www.transperola.com.br',
            'Fabiano',
            'Transportadora',
            'Sim',
            new Date().toLocaleDateString('pt-BR'),
            'Sim'
        ];

        console.log('\n📋 Adicionando exemplo de transportadora...');
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:T`,
            valueInputOption: 'RAW',
            resource: {
                values: [exampleRow]
            }
        });

        console.log('✅ Exemplo adicionado com sucesso!');
        console.log('\n🎯 Sistema pronto para usar!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Erro ao criar headers:', err.message);
        if (err.response?.data?.error) {
            console.error('Detalhes:', err.response.data.error);
        }
        process.exit(1);
    }
}

setupHeaders();
