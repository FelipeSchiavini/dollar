# Guia de Deploy - Render.com

Este aplicativo precisa de um servidor Node.js persistente (não funciona em Vercel/Netlify por causa do WhatsApp). O **Render.com** é a melhor opção gratuita/barata.

## Opção 1: Automático (Blueprints) - RECOMENDADO

1. Crie uma conta no [Render.com](https://render.com).
2. Clique em **New +** -> **Blueprint**.
3. Conecte seu repositório do GitHub.
4. O Render detectará automaticamente o arquivo `render.yaml` e configurará tudo para você.
5. Clique em **Apply**.

## Opção 2: Manual (Web Service)

Se preferir configurar manualmente:

1. Crie uma conta no [Render.com](https://render.com).
2. Clique em **New +** -> **Web Service**.
3. Conecte seu repositório do GitHub.

## Passo 2: Configurações

Preencha os campos da seguinte forma:

- **Name**: `monitor-dolar` (ou o que preferir)
- **Region**: Escolha a mais próxima (ex: Ohio ou Frankfurt)
- **Branch**: `main`
- **Root Directory**: Deixe em branco (`.`)
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Instance Type**: Free (para testes) ou Starter (para produção 24/7)

## Passo 3: Variáveis de Ambiente

Clique em **Advanced** ou vá na aba **Environment** após criar e adicione:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `true` |

*(O script `postinstall` no `package.json` cuidará da instalação do Chrome controlado)*

## Passo 4: Deploy

Clique em **Create Web Service**.

O Render vai:
1. Baixar o código.
2. Instalar dependências (`npm install`).
3. Rodar o script `postinstall` (Baixar o Chrome).
4. Iniciar o servidor (`npm run start`).

## Observações Importantes

- **Persistent Disk (Opcional)**: No plano Free, se o Render reiniciar, você pode perder a conexão do WhatsApp (precisará escanear o QR de novo). Para produção, o ideal é usar o plano "Starter" e configurar um disco persistente para salvar a pasta `.wwebjs_auth`.
- **Dormência**: O plano Free "dorme" após 15 min de inatividade. O WhatsApp será desconectado. Para um monitor real, use o plano pago (~$7/mês).
