const axios = require('axios');

const CLOUD_URL = 'https://bling-proxy-api-255108547424.southamerica-east1.run.app/bling/pedidos';

const mockEvent = {
    event: 'pedido.created',
    data: {
        id: '25521176187' // Um ID real de um pedido recente para teste
    }
};

async function test() {
    console.log(`Enviando POST para: ${CLOUD_URL}`);
    try {
        const response = await axios.post(CLOUD_URL, mockEvent);
        console.log('Status do Servidor:', response.status);
        console.log('Resposta:', response.data);
    } catch (error) {
        console.error('ERRO ao enviar webhook:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Mensagem:', error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

test();
