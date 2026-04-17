# Stack Tecnológica - MKS Service

Este documento detalha as tecnologias, frameworks e serviços utilizados no desenvolvimento do sistema MKS Service.

## 🎨 Frontend (Interface e Experiência)

### Core
- **HTML5 & CSS3**: Estrutura e estilização base utilizando padrões modernos.
- **Vanilla JavaScript (ES6+)**: Lógica do cliente organizada no padrão **Modular (Revealing Module Pattern)** para garantir encapsulamento e reutilização.
- **PWA (Progressive Web App)**: A aplicação mobile (`/appMobile`) é desenvolvida para funcionar como um aplicativo nativo em dispositivos móveis.

### Estilização e UI
- **Tailwind CSS**: Utilizado para componentes rápidos e layouts responsivos (em partes do projeto).
- **Vanilla CSS**: Estilos customizados focados em performance e fidelidade visual.
- **Google Fonts**: Tipografia moderna (Inter, Roboto).
- **Toastify.js**: Sistema de notificações tipo "Toast" para feedback do usuário.

---

## ⚙️ Backend (Servidor e Lógica)

### Infraestrutura
- **Node.js**: Ambiente de execução para o servidor principal.
- **Express.js**: Framework web utilizado para criar a API de proxy e rotas de integração.
- **Google Cloud Run**: O backend está hospedado de forma *serverless*, escalando conforme a demanda.

### Processamento e Integração
- **Axios**: Cliente HTTP utilizado para comunicação com APIs externas.
- **Google Cloud APIs**: Integração com Google Sheets (via Google Apps Script) e outras ferramentas do ecossistema Google.

---

## 💾 Banco de Dados e Sincronização

### Persistência e Real-time
- **Google Cloud Firestore (Firebase)**: Banco de dados NoSQL utilizado para:
    - Armazenamento de configurações.
    - Sincronização de estado entre dispositivos.
    - Sincronização de observações e chat de pedidos.
- **Firestore Snapshots**: Utilizado para implementar o padrão **Real-time Sync**, substituindo o uso de WebSockets tradicionais/Socket.io para reduzir custos e complexidade no Cloud Run.

---

## ☁️ Hospedagem e Cloud

- **Firebase Hosting**: Hospedagem global e rápida para o frontend (estático).
- **Google Cloud Platform (GCP)**: Provedor principal de infraestrutura, incluindo Cloud Run e seguranças de rede.

---

## 🔌 Integrações Externas

- **Bling ERP**: Integração profunda para gestão de pedidos, notas fiscais (NFe) e produtos via proxy seguro.
- **Loja Integrada**: Sincronização de pedidos e status de vendas do e-commerce.
- **Google Apps Script**: Automações baseadas em planilhas para fluxos de trabalho legados ou específicos.

---

## 🛠️ Ferramentas de Desenvolvimento

- **Git & GitHub**: Controle de versão e colaboração.
- **Firebase CLI**: Gerenciamento de deploys e regras do Firestore.
- **Google Cloud SDK**: Gerenciamento de recursos de nuvem.
