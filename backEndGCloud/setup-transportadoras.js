/**
 * Script para configurar a aba "Transportadoras" na planilha
 * Cria os headers das colunas automaticamente
 */
const { google } = require('googleapis');
const admin = require('firebase-admin');

// Inicializar Firebase Admin se ainda não está
try {
    admin.app();
} catch (e) {
    admin.initializeApp({
        projectId: "mksservice-71367430-58374"
    });
}

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
        const sheets = google.sheets({ version: 'v4' });
        
        // Usar Application Default Credentials (ADC)
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        
        sheets.spreadsheets.values.update({
            auth: auth,
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1`,
            valueInputOption: 'RAW',
            resource: {
                values: [HEADERS]
            }
        }, (err, res) => {
            if (err) {
                console.error('Erro ao atualizar headers:', err);
                process.exit(1);
            }
            console.log('✅ Headers criados com sucesso!');
            console.log('Colunas:', HEADERS);
            process.exit(0);
        });
    } catch (err) {
        console.error('Erro:', err);
        process.exit(1);
    }
}

setupHeaders();
