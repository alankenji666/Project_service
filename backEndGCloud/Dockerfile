# Use a imagem oficial do Node.js
FROM node:20-slim

# Cria o diretório da aplicação
WORKDIR /usr/src/app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install --production

# Copia o restante do código
COPY . .

# Expõe a porta que o Cloud Run usa (8080 por padrão)
EXPOSE 8080

# Comando para iniciar a aplicação
CMD [ "node", "index.js" ]
