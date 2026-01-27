
      /**
       * apiConfig.js
       * 
       * Centraliza todas as URLs de API da aplicação.
       * Isso facilita a manutenção e a troca entre ambientes (desenvolvimento/produção).
       */
      
      export const API_URLS = {
          // APIs de Autenticação e Usuários
          LOGIN: 'https://bling-proxy-api-255108547424.southamerica-east1.run.app/auth/login',
          GET_ALL_USERS: 'https://bling-proxy-api-255108547424.southamerica-east1.run.app/auth/get-all-users',
          UPDATE_USER: 'https://bling-proxy-api-255108547424.southamerica-east1.run.app/auth/update-user',
      
          // APIs de Dados (Google Apps Script)
          PRODUCTS: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/produtos",
          ORDERS_TERCEIROS: "https://script.google.com/macros/s/AKfycbwYWSPrgMdA5IGVYnH5EVJ3FLnU1THcI6SQa8opOHkjN_CZO-G2S7JJDuTqZQDd0Y2s/exec",
          ORDERS_FABRICA: "https://script.google.com/macros/s/AKfycbwKsLHoAhfLxEcq6nyu9lCHybh3EOGqEku-shgdoomSg8SAyL9VcUsWWjzVPmvcSkvOTA/exec",
          LOJA_INTEGRADA_ORDERS: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/loja-integrada/orders",
          NFE: "https://script.google.com/macros/s/AKfycbwetL7dn2Zmsr6ZPlE6x6B2JTahGOyhfENK6AoL-2HwEvffyTejBuHvIp7S_kgHI3_t/exec",
          SAIDAS_FABRICA: "https://script.google.com/macros/s/AKfycbxEJwbvF9f0NBQ_ueTsXSSXxeOrr7AiGl58v6UKgJQ1NGI9ZOwrpS8vXYkwgRWe285n/exec", // URL fictícia para Saídas Fábrica
          SAIDAS_GARANTIA: "https://script.google.com/macros/s/AKfycbz5szPRjcuugJ3JZjGozdXMhcUiYzmKnAMqoqvOywWCpm7935YH6p-Fay-M0CZPni89sQ/exec", // URL fictícia para Saídas Garantia
      
          // APIs de Ações (Cloud Functions)
          WEBHOOK_LAUNCH: "https://bling-proxy-api-255108547424.southamerica-east1.run.app",
          ORDERS_UPDATE: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/estoque/update-stock",
          NFE_CONFERENCIA: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/nfe/conferencia",
          NFE_OBSERVATION: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/nfe/conferencia/observacao",
          SAIDA_FABRICA_LAUNCH: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/saida-fabrica",
          SAIDA_GARANTIA_LAUNCH: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/saida-garantia",
      
          // APIs de Observações
          TERCEIROS_OBSERVATION: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/add-requisition-observation",
          FABRICA_OBSERVATION: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/add-fabrica-observation",
          SAIDA_FABRICA_OBSERVATION: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/add-fabrica-observation", // Reutiliza a mesma API de fábrica
          SAIDA_GARANTIA_OBSERVATION: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/add-garantia-observation",
      
          // APIs de Atendimento WhatsApp
          ATENDIMENTOS_GET: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/whatsapp/get-atendimentos",
          ATENDIMENTO_STATUS_UPDATE: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/whatsapp/update-status",
          ATENDIMENTO_START: "https://bling-proxy-api-255108547424.southamerica-east1.run.app/whatsapp/iniciar-atendimento",
      };
      