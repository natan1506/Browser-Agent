# AI Browser Agent Extension

This project is a browser extension built with [React](https://reactjs.org/), [Tailwind CSS](https://tailwindcss.com/) and [Vite](https://vitejs.dev/) via the `vite-plugin-web-extension` package.

## Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 18+ ou superior recomendada)
- `npm` (geralmente vem incluído com o Node.js)

## Instalação

1. Clone o repositório ou navegue até o diretório do projeto:
   ```bash
   cd /Volumes/Armazenamento/projects/extension
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

## Desenvolvimento

Para rodar a extensão em modo de desenvolvimento (com hot-reload):

```bash
npm run dev
```

Isso irá construir a extensão, criar a pasta `dist/` e ficar observando as mudanças nos arquivos.

### Como carregar a extensão no Chrome

1. Abra o navegador Google Chrome (ou Chromium).
2. Acesse `chrome://extensions/`.
3. Ative a opção **"Modo do desenvolvedor"** no canto superior direito.
4. Clique no botão **"Carregar sem compactação"** (Load unpacked).
5. Selecione a pasta `dist` que foi gerada na raiz deste projeto.

Agora, qualquer alteração que você fizer no código refletirá automaticamente!

## Produção

Para gerar o build final otimizado para distribuição/produção:

```bash
npm run build
```

O resultado continuará na pasta `dist`, pronto para ser empacotado e submetido para as lojas de extensões.

## Validação de Tipos (TypeScript)

Para rodar apenas a checagem do TypeScript sem gerar o build, use:

```bash
npm run typecheck
```

## Arquitetura do Projeto
A maioria do código fonte fica localizada em `src/`:
- `manifest.json`: Arquivo de manifesto da extensão.
- `background/`: Scripts em segundo plano (background worker).
- `content/`: Scripts de conteúdo para interagir com o DOM das páginas web.
- `sidepanel/`: Interface em React para a aba lateral da extensão.
- `shared/`: Componentes e funções compartilhados.
