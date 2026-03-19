#!/bin/bash

# Script de Configuração Inicial - MKS Service

echo "🚀 Iniciando configuração do ambiente MKS Service..."

# 1. Verificar se o Node.js está instalado
if ! command -v node &> /dev/null
then
    echo "❌ Node.js não encontrado. Por favor, instale o Node.js antes de continuar."
    exit 1
fi

echo "📦 Instalando dependências do Backend (backEndGCloud)..."
cd backEndGCloud
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependências do Backend instaladas com sucesso!"
else
    echo "❌ Erro ao instalar dependências do Backend."
    exit 1
fi

# 2. Criar .env se não existir
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env a partir do .env.example..."
    cp .env.example .env
    echo "⚠️  Lembre-se de revisar o arquivo backEndGCloud/.env"
fi

cd ..

# 3. Finalização
echo ""
echo "----------------------------------------------------"
echo "🎉 Configuração concluída!"
echo "----------------------------------------------------"
echo "Para rodar o backend: cd backEndGCloud && npm start"
echo "Para rodar o frontend: firebase serve"
echo "Consulte o arquivo SETUP.md para mais detalhes."
echo "----------------------------------------------------"
