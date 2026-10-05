const fs = require('fs');
let js = fs.readFileSync('js/main.js', 'utf8');

// Modificar o bloco de Em Produção
const emProducaoRegex = /if \(!ans\) \{\s*event\.target\.value = 'Criado';\s*return;\s*\}\s*_loadingOverlay\.classList\.remove\('hidden'\);/g;

const emProducaoReplacement = `if (!ans) {
                                        event.target.value = 'Criado';
                                        return;
                                    }
                                    
                                    const detailsBox = _loadingOverlay.querySelector('.bg-gray-900');
                                    if (detailsBox) detailsBox.style.display = 'none';
                                    _loadingOverlay.querySelector('p').textContent = 'Enviando p/ Linha...';
                                    _loadingOverlay.classList.remove('hidden');`;

js = js.replace(emProducaoRegex, emProducaoReplacement);

// Modificar o bloco de Criado
const criadoRegex = /\} else if \(newStatus === 'Criado'\) \{\s*_loadingOverlay\.classList\.remove\('hidden'\);/g;

const criadoReplacement = `} else if (newStatus === 'Criado') {
                                const detailsBox = _loadingOverlay.querySelector('.bg-gray-900');
                                if (detailsBox) detailsBox.style.display = 'none';
                                _loadingOverlay.querySelector('p').textContent = 'Atualizando status...';
                                _loadingOverlay.classList.remove('hidden');`;

js = js.replace(criadoRegex, criadoReplacement);

// Modificar o bloco de checkbox standard no gerenciarPedidos ou onde é chamado
const launchRegex = /function _executeLaunch\(type, requisitionCode, itemsToLaunch\) \{\s*_loadingOverlay\.classList\.remove\('hidden'\);/g;

const launchReplacement = `function _executeLaunch(type, requisitionCode, itemsToLaunch) {
                  const detailsBox = _loadingOverlay.querySelector('.bg-gray-900');
                  if (detailsBox) detailsBox.style.display = 'none';
                  _loadingOverlay.querySelector('p').textContent = 'Lançando requisição...';
                  _loadingOverlay.classList.remove('hidden');`;

js = js.replace(launchRegex, launchReplacement);

const confirmActionRegex = /if \(confirmed\) \{\s*_loadingOverlay\.classList\.remove\('hidden'\);/g;

const confirmActionReplacement = `if (confirmed) {
                    const detailsBox = _loadingOverlay.querySelector('.bg-gray-900');
                    if (detailsBox) detailsBox.style.display = 'none';
                    _loadingOverlay.querySelector('p').textContent = 'Processando...';
                    _loadingOverlay.classList.remove('hidden');`;

js = js.replace(confirmActionRegex, confirmActionReplacement);


// Restaurar o overlay para o _fetchData()
const fetchDataRegex = /const container = document\.getElementById\('loading-details'\);\s*if \(container\) container\.innerHTML = ''; \/\/ Limpa logs anteriores\s*_loadingOverlay\.classList\.remove\('hidden'\);\s*_logLoading\('Iniciando sincronização\.\.\.'\);/g;

const fetchDataReplacement = `const container = document.getElementById('loading-details');
                if (container) container.innerHTML = ''; // Limpa logs anteriores

                const detailsBox = _loadingOverlay.querySelector('.bg-gray-900');
                if (detailsBox) detailsBox.style.display = '';
                _loadingOverlay.querySelector('p').textContent = 'Atualizando dados...';
                _loadingOverlay.classList.remove('hidden');
                _logLoading('Iniciando sincronização...');`;

js = js.replace(fetchDataRegex, fetchDataReplacement);

fs.writeFileSync('js/main.js', js);
console.log('Overlay de loading atualizado para ser mais minimalista fora do carregamento inicial.');
