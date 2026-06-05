# Finanças — Controle Pessoal (PWA)

Aplicativo de gerenciamento financeiro pessoal **mobile-first**, feito como **Progressive Web App (PWA)**.
Pode ser usado no celular como se fosse um app nativo — basta abrir a página e tocar em **"Adicionar à tela inicial"**.

- 100% client-side (HTML, CSS e JavaScript puros, sem frameworks)
- Funciona **offline** após a primeira visita (service worker faz cache do app shell)
- Todos os dados ficam **no próprio aparelho** (`localStorage`) — nada é enviado para servidores
- Tema claro/escuro
- Português do Brasil, valores em Real (R$) por padrão (configurável)

## Recursos

- Dashboard com saldo do mês, receitas, despesas e navegação por mês
- Gráficos em SVG nativos:
  - Distribuição de despesas por categoria (donut)
  - Evolução dos últimos 6 meses (barras receitas vs despesas)
- Cadastro/edição/exclusão de transações (receita e despesa) com categoria, data e descrição
- Lista de transações com busca textual e filtros por tipo
- **Orçamentos** mensais por categoria com barra de progresso
- **Metas de economia** (ex.: viagem, reserva) com prazo e progresso
- Personalização de **categorias** (criar/remover, cores automáticas)
- **Exportar/Importar** backup em JSON
- Atalhos da PWA (Android): "Nova despesa" e "Nova receita" direto do ícone

## Como rodar localmente

Não há build. Basta servir a pasta com qualquer servidor estático HTTP:

```bash
cd finance-app
python3 -m http.server 8080
# Abra http://localhost:8080
```

> A PWA exige `https://` ou `http://localhost` para que o service worker funcione.

## Como instalar no celular

1. Acesse a URL pelo navegador do celular (Chrome/Safari).
2. Toque no menu do navegador → **"Adicionar à tela inicial"** / **"Instalar aplicativo"**.
3. Pronto! O ícone aparece como um app comum e abre em tela cheia.

## Como publicar online (grátis)

Como é um site totalmente estático, dá para hospedar em qualquer destes serviços sem configuração extra:

- **GitHub Pages** — habilite Pages no repositório e aponte para esta pasta.
- **Netlify / Vercel / Cloudflare Pages** — basta arrastar a pasta `finance-app/` ou conectar o repositório.

## Estrutura

```
finance-app/
├── index.html              # Markup principal (cabeçalho, telas, modais, bottom nav)
├── manifest.webmanifest    # Metadados PWA (nome, ícones, atalhos)
├── sw.js                   # Service worker (cache offline)
├── assets/
│   ├── styles.css          # Estilo mobile-first com tema claro/escuro
│   ├── app.js              # Toda a lógica da aplicação
│   └── icons/              # Ícones SVG/PNG (192, 512, maskable)
└── README.md
```

## Privacidade

Tudo é processado e armazenado **localmente** no seu navegador. Para limpar tudo,
acesse **Ajustes → Apagar todos os dados** ou limpe os dados do site nas configurações do navegador.

## Próximos passos (ideias)

- Suporte a múltiplas contas (carteira, poupança, cartão)
- Transações recorrentes
- Importação de CSV de extrato bancário
- Sincronização entre dispositivos via WebDAV ou conta própria
- Notificações de orçamento estourado

---

Versão 1.0 · Licença MIT (uso livre)
