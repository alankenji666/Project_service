@echo off
echo 🚀 Iniciando Deploy do Backend (MKS Service)...

:: Caminho para o gcloud (ajustado para o seu ambiente)
set GCLOUD_PATH="C:\Users\alan_\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

echo 📦 1. Construindo imagem no Cloud Build...
call %GCLOUD_PATH% builds submit --tag gcr.io/bling-integracao-463115/bling-proxy-api backEndGCloud

echo 🚢 2. Fazendo deploy para o Cloud Run...
call %GCLOUD_PATH% run deploy bling-proxy-api --image gcr.io/bling-integracao-463115/bling-proxy-api --region southamerica-east1 --platform managed --quiet

echo 🎉 Deploy concluído com sucesso!
pause
