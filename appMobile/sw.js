// appMobile/sw.js

// Importa as configurações da API para que a URL de update esteja disponível no Service Worker
importScripts('../js/apiConfig.js');

// 1. Definições do Cache
const CACHE_NAME = 'ajusta-estoque-app-v1';
const CACHE_FILES = [
    './ajustaEstoqueApp.html',
    '../css/styles.css',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/html5-qrcode',
    '../js/apiConfig.js',
    '../js/utils.js'
    // Adicione aqui um ícone para notificações, se tiver. Ex: 'images/icon-192x192.png'
];

// --- LÓGICA DE BANCO DE DADOS (INDEXEDDB) PARA O SERVICE WORKER ---
const DB_NAME = 'ajuste-estoque-db';
const STORE_NAME = 'pending-adjustments';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

function getAllPendingAdjustments() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const keysRequest = store.getAllKeys();
            const dataRequest = store.getAll();
            
            let keys, data;
            
            keysRequest.onsuccess = () => {
                keys = keysRequest.result;
                if (data !== undefined) resolve({ keys, data });
            };
            dataRequest.onsuccess = () => {
                data = dataRequest.result;
                if (keys !== undefined) resolve({ keys, data });
            };
            keysRequest.onerror = event => reject(event.target.error);
            dataRequest.onerror = event => reject(event.target.error);
        } catch (error) {
            reject(error);
        }
    });
}

function deleteAdjustmentFromDB(key) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = event => reject(event.target.error);
        } catch (error) {
            reject(error);
        }
    });
}
// --- FIM DA LÓGICA DE BANCO DE DADOS ---


// 2. Instalação do Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Adicionando arquivos essenciais ao cache...');
                return cache.addAll(CACHE_FILES);
            })
            .then(() => {
                console.log('[Service Worker] Arquivos cacheados com sucesso!');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[Service Worker] Falha ao cachear arquivos:', error);
            })
    );
});

// 3. Ativação do Service Worker
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando...');
    event.waitUntil(self.clients.claim());
});

// 4. Interceptação de Requisições (Estratégia Cache-First para GET)
self.addEventListener('fetch', (event) => {
    // Ignora requisições que não são GET (ex: POST para a API)
    if (event.request.method !== 'GET') {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Se encontrar no cache, retorna do cache.
                if (response) {
                    return response;
                }
                // Senão, busca na rede.
                return fetch(event.request);
            })
    );
});

// 5. NOVO: Evento de Sincronização em Segundo Plano
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-adjustments') {
        console.log('[Service Worker] Evento de Sync recebido. Iniciando sincronização de ajustes...');
        event.waitUntil(syncAdjustments());
    }
});

// Função que executa a sincronização
async function syncAdjustments() {
    try {
        const { keys, data } = await getAllPendingAdjustments();
        if (!data || data.length === 0) {
            console.log('[Service Worker] Nenhum ajuste pendente para sincronizar.');
            return;
        }

        console.log(`[Service Worker] Sincronizando ${data.length} ajustes pendentes.`);

        const syncPromises = data.map((payload, index) => {
            const dbKey = keys[index];
            console.log(`[Service Worker] Enviando payload (key: ${dbKey})...`);

            return fetch(API_URLS.ORDERS_UPDATE, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(response => {
                // Se a API respondeu (com sucesso ou erro), a requisição foi recebida.
                // Então, podemos remover o item da fila para não reenviar.
                if (response.ok) {
                    console.log(`[Service Worker] Ajuste com chave ${dbKey} sincronizado com sucesso.`);
                } else {
                    console.error(`[Service Worker] Erro da API ao sincronizar (chave ${dbKey}): Status ${response.status}. A requisição será removida da fila.`);
                }
                return deleteAdjustmentFromDB(dbKey);
            });
        });

        await Promise.all(syncPromises);

        // Notifica o usuário que a sincronização foi concluída.
        self.registration.showNotification('Sincronização Concluída!', {
            body: `Seus ${data.length} ajustes de estoque feitos offline foram salvos no sistema.`,
            icon: 'https://img.icons8.com/ios-filled/100/000000/cloud-checked.png' // Ícone genérico
        });

    } catch (error) {
        console.error('[Service Worker] Erro geral durante a sincronização. O navegador tentará novamente mais tarde.', error);
        // O navegador irá tentar rodar a sincronização novamente mais tarde.
    }
}
