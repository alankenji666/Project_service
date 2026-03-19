# Guia de Configuração - MKS Service

Este guia ajudará você a configurar o ambiente de desenvolvimento para o projeto MKS Service na sua IDE.

## 🚀 Pré-requisitos

Antes de começar, certifique-se de ter instalado:
- **Node.js** (v18 ou superior)
- **NPM** (geralmente vem com o Node)
- **Firebase CLI** (`npm install -g firebase-tools`)
- **Google Cloud SDK (gcloud)** (opcional, mas recomendado para autenticação local)

---

## 📂 Estrutura do Projeto

- `/` (Raiz): Frontend (HTML/JS/CSS).
- `/backEndGCloud`: Servidor Express (Node.js) que roda no Cloud Run.
- `/js`: Lógica do frontend e configurações de API.
- `/appMobile`: Versão mobile (PWA).

---

## 🛠️ Passo a Passo para Configuração

### 1. Instalação de Dependências

O projeto possui dependências no backend. Execute o script de setup ou instale manualmente:

```bash
# Usando o script automatizado (recomendado):
bash setup.sh

# OU manualmente:
cd backEndGCloud
npm install
```

### 2. Autenticação (Google Cloud / Firebase)

O backend utiliza o Firestore e a API do Google Sheets. Para rodar localmente, você precisa de credenciais:

1.  **GCloud CLI**: No terminal, execute:
    ```bash
    gcloud auth application-default login
    ```
    Isso permitirá que o backend use suas credenciais para acessar o projeto no Google Cloud.

2.  **Firebase**: Faça login no Firebase CLI:
    ```bash
    firebase login
    ```

### 3. Variáveis de Ambiente

Crie um arquivo `.env` dentro da pasta `backEndGCloud/` (veja o `.env.example` para referência).

---

## 🖥️ Como Executar

### Rodando o Backend (Localmente)

```bash
cd backEndGCloud
npm start
```
O servidor rodará em `http://localhost:8080`.

### Rodando o Frontend (Localmente)

Você pode usar qualquer servidor estático ou o próprio Firebase:
```bash
firebase serve --only hosting
```
O frontend estará acessível em `http://localhost:5000`.

---

## 💡 Dicas para a IDE (VS Code / IDX)

### Extensões Recomendadas
- **ESLint**: Para manter o padrão de código.
- **Prettier**: Para formatação automática.
- **Firebase Explorer**: Para gerenciar Firestore/Hosting diretamente na IDE.

### Debugging no VS Code
O projeto já inclui (ou você pode pedir para eu criar) um arquivo `.vscode/launch.json` para debugar o Node.js pressionando F5.

### Configuração Automática (IDX)
Se você estiver usando o Project IDX, o arquivo `.idx/dev.nix` já cuida de instalar as ferramentas necessárias toda vez que o ambiente é aberto.

---

## 📝 Comandos Úteis

- `npm install`: Instala dependências (dentro da pasta backEndGCloud).
- `firebase deploy`: Envia o frontend e regras do Firestore para produção.
- `gcloud run deploy`: Envia o backend para o Cloud Run.
