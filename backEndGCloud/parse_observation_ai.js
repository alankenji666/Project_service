const express = require('express');
const axios = require('axios');

module.exports = function() {
    const router = express.Router();

    const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
    const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

    router.post('/', async (req, res, next) => {
        try {
            const { text } = req.body;
            if (!text) {
                return res.status(400).json({ error: 'Texto da observação não fornecido.' });
            }

            const prompt = `Você é um assistente especializado em extrair dados de notas fiscais.
Sua tarefa é extrair os seguintes dados da nota, preenchendo um JSON estrito:
1. "volume": Inteiro (ex: 1, 2). Encontre "X VOLUME" ou "X VOL".
2. "peso": Float (ex: 14.5). Encontre "PESO X KG".
3. "parcelas": Array de inteiros. Extraia das condições de pagamento (ex: "FATURADO 28/42 DDL" -> [28, 42]). "DDL" ou "DIAS" significam dias. Se for "À vista", retorne [0].
4. "freteConta": Inteiro. 0 se CIF (por conta do remetente), 1 se FOB (por conta do destinatário/cliente). Se omitido, retorne null.
5. "transportadora": String com o nome limpo da transportadora (ex: "Bauer", "Jamef", "Correios"). Se for "CLIENTE RETIRA" ou "RETIRADA", retorne "Retirada".

Retorne EXATAMENTE e APENAS o JSON. SEM ZEROS À ESQUERDA PARA NÚMEROS!

Texto para analisar:
${text}
`;

            let response;
            let retries = 3;
            while (retries > 0) {
                try {
                    response = await axios.post(GROQ_API_URL, {
                        model: 'openai/gpt-oss-20b',
                        messages: [
                            { role: 'system', content: 'You are a precise data extraction API that only outputs valid JSON.' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.1,
                        response_format: { type: 'json_object' }
                    }, {
                        headers: {
                            'Authorization': `Bearer ${GROQ_API_KEY}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    break; 
                } catch (e) {
                    retries--;
                    if (e.response && (e.response.status >= 500 || e.response.status === 429) && retries > 0) {
                        console.warn(`[Groq AI Parse] Servidor ocupado (${e.response.status}). Tentando novamente em 1.5s...`);
                        await new Promise(r => setTimeout(r, 1500));
                    } else {
                        throw e; 
                    }
                }
            }

            const aiText = response.data.choices[0].message.content;
            
            let cleanText = aiText.trim();
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanText = jsonMatch[0];
            } else {
                cleanText = cleanText.replace(/```json/gi, '').replace(/```/g, '').trim();
            }

            const parsedData = JSON.parse(cleanText);

            res.status(200).json({
                status: 'success',
                data: parsedData
            });

        } catch (error) {
            console.error('[Groq AI Parse] Erro ao processar:', error.response ? error.response.data : error.message);
            res.status(500).json({ error: 'Falha ao processar com IA.' });
        }
    });

    return router;
};
