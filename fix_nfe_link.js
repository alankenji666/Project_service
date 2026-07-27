const fs = require('fs');
const file = 'backEndGCloud/pedidos.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Corrigir o campo de vinculação da NFe na V3
const target1 = `                payloadCriacao = {
                    tipo: 1, // 1 = Saída
                    pedido: { id: parseInt(idPedido) }
                };`;
const rep1 = `                payloadCriacao = {
                    tipo: 1, // 1 = Saída
                    documentoVinculado: { id: parseInt(idPedido) }
                };`;

const target1_custom = `                payloadCriacao = req.body;
                payloadCriacao.tipo = 1; // 1 = Saída
                payloadCriacao.pedido = { id: parseInt(idPedido) };`;
const rep1_custom = `                payloadCriacao = req.body;
                payloadCriacao.tipo = 1; // 1 = Saída
                payloadCriacao.documentoVinculado = { id: parseInt(idPedido) };`;

// 2. Adicionar a mudança automática de status
const target2 = `                console.log(\`[Bling] NF-e \${idNota} enviada para processamento.\`);
                return res.status(200).send({ 
                    status: 'success', 
                    message: "NF-e gerada e enviada com sucesso!",
                    data: { idNota, response: resEnvio.data } 
                });`;
const rep2 = `                console.log(\`[Bling] NF-e \${idNota} enviada para processamento.\`);

                // NOVO: Atualizar situação do pedido para "Atendido" (9) após envio da NFe
                try {
                    console.log(\`[Bling] Atualizando situação do pedido \${idPedido} para Atendido (9) após gerar NFe...\`);
                    await httpClient.patch(\`\${BLING_API_BASE_URL}/pedidos/vendas/\${idPedido}/situacoes/9\`, {}, {
                        headers: { 'Authorization': \`Bearer \${accessToken}\` }
                    });
                    
                    // Sincroniza a planilha instantaneamente via webhook local
                    const port = process.env.PORT || 8080;
                    httpClient.post(\`http://localhost:\${port}/webhook/pedidos-bling\`, {
                        event: 'situacao.alterada', 
                        data: { id: idPedido }
                    }).catch(e => console.log("[Webhook Local] Erro na sync:", e.message));

                } catch (errSituacao) {
                    console.warn(\`[Bling Warning] NFe enviada, mas falha ao alterar situação do pedido para Atendido:\`, errSituacao.message);
                }

                return res.status(200).send({ 
                    status: 'success', 
                    message: "NF-e gerada e enviada com sucesso! O pedido foi atualizado para Atendido.",
                    data: { idNota, response: resEnvio.data } 
                });`;

let modified = false;
if (content.includes(target1)) {
    content = content.replace(target1, rep1);
    modified = true;
}
if (content.includes(target1_custom)) {
    content = content.replace(target1_custom, rep1_custom);
    modified = true;
}
if (content.includes(target2)) {
    content = content.replace(target2, rep2);
    modified = true;
}

if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('SUCCESS');
} else {
    console.log('TARGETS NOT FOUND');
}
