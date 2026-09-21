# Inteligência de Preços — Apucarana

Painel de acompanhamento de **preço médio** por vendedor, produto e cliente.
Funciona como aplicativo instalável (PWA) no computador e no celular, com uso offline.

**Escopo dos dados:** Oportunidades Fechado Ganho · Filiais 01052 e 1026 · exceto Juliana Castro, Alessandra Borgato e Margarete Oliveira.

---

## 1. Publicar no GitHub Pages

1. Crie um repositório no GitHub (pode ser **privado** — o Pages de repositório privado exige conta Team/Enterprise; para conta gratuita, use repositório **público**).
2. Envie todos os arquivos desta pasta para a **raiz** do repositório (não dentro de uma subpasta).

   Pelo site: **Add file → Upload files**, arraste tudo e confirme o commit.

   Pelo terminal:

   ```bash
   git init
   git add .
   git commit -m "Painel de preço médio - Apucarana"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
   git push -u origin main
   ```

3. No repositório, vá em **Settings → Pages**.
4. Em *Build and deployment*, escolha **Deploy from a branch**, selecione a branch **main** e a pasta **/ (root)**. Salve.
5. Aguarde 1–2 minutos. O endereço será:

   ```
   https://SEU-USUARIO.github.io/SEU-REPOSITORIO/
   ```

Todos os caminhos do projeto são relativos, então ele funciona em qualquer usuário, qualquer nome de repositório e também em domínio próprio.

> **Importante:** o painel precisa ser aberto por um endereço `http://` ou `https://`.
> Abrir o `index.html` com duplo clique (`file://`) não carrega os dados, porque o navegador bloqueia a leitura do arquivo JSON.
> Para testar na sua máquina, veja a seção 5.

---

## 2. Instalar como aplicativo

Depois de publicado, abra o endereço e instale:

**Android (Chrome)** — menu ⋮ → *Instalar aplicativo* / *Adicionar à tela inicial*.

**iPhone / iPad (Safari)** — botão Compartilhar → *Adicionar à Tela de Início*.

**Windows / macOS (Chrome ou Edge)** — ícone de instalação na barra de endereços, ou menu ⋮ → *Instalar*.

Uma vez instalado, o painel abre em janela própria, sem barra de navegador, e continua funcionando **sem internet** (com os últimos dados baixados).

---

## 3. Estrutura dos arquivos

```
.
├── index.html                          # página do painel (interface)
├── painel_preco_medio_apucarana.html   # redireciona para index.html (mantém o link antigo)
├── assets/
│   └── app.js                          # toda a lógica: abas, cálculos, gráficos, IA, exportações
├── data/
│   └── alldb.json                      # BASE DE DADOS — é só este arquivo que muda a cada atualização
├── manifest.json                       # identidade do app (nome, cores, ícones, atalhos)
├── sw.js                               # service worker (instalação e modo offline)
├── icon-192.png, icon-512.png          # ícones do aplicativo
├── icon-maskable-192.png, icon-maskable-512.png
├── apple-touch-icon.png, favicon.svg
├── .nojekyll                           # evita que o GitHub Pages processe os arquivos
├── .gitignore
└── README.md
```

---

## 4. Atualizar os dados

A base fica **isolada** em `data/alldb.json`. Para publicar um novo período:

1. Substitua o arquivo `data/alldb.json`.
2. Abra `sw.js` e aumente a linha `const SW_VERSION = 'v2';` para `'v3'`, `'v4'`… (isso avisa quem já tem o app instalado que há versão nova).
3. Faça o commit/upload. Em poucos minutos o Pages atualiza sozinho.

Quem estiver com o app aberto verá o aviso **"Nova versão do painel disponível"** com o botão *Atualizar*.

### Formato de `data/alldb.json`

Objeto com uma chave por período — `p1`, `p2`, `p3`, … (a ordem dos botões de período no painel segue esta ordem):

```jsonc
{
  "p1": {
    "periodo": "01 a 04/09/2026",
    "filtro":  "Oportunidades Fechado Ganho · Filiais 01052 e 1026 · exceto ...",

    "totals":  { "fat": 0, "qtd": 0, "nvend": 0, "nprod": 0, "nops": 0, "nclientes": 0 },

    "tabela":  { "NOME DO PRODUTO": 16.5 },

    "vendors": {
      "Nome do Vendedor": {
        "raw": "NOME DO VENDEDOR",
        "qtd": 0, "fat": 0, "nprod": 0, "pmed": 0,
        "items": [{
          "produto": "NOME DO PRODUTO",
          "qtd": 0, "pmed": 0, "fat": 0, "ops": 0,
          "ptab": 16.5, "pvenda": 17.6, "pliq": null,
          "rows": [
            { "op": "OP-000000", "cli": "CLIENTE LTDA", "qtd": 0, "pv": 0, "fat": 0, "data": "01/09/2026" }
          ]
        }]
      }
    },

    "products": {
      "NOME DO PRODUTO": {
        "qtd": 0, "fat": 0, "pmed": 0, "ptab": 16.5, "nvend": 0,
        "sellers": [{ "vend": "Nome do Vendedor", "qtd": 0, "pmed": 0, "fat": 0, "pvenda": 0, "pliq": null }]
      }
    },

    "clients": {
      "CLIENTE LTDA": {
        "qtd": 0, "fat": 0, "nprod": 0, "nvend": 0,
        "produtos": [{ "produto": "NOME DO PRODUTO", "qtd": 0, "fat": 0, "pmed": 0, "ops": 0, "ptab": 16.5 }]
      }
    }
  }
}
```

Os blocos `totals`, `products` e `clients` são somatórios de `vendors` — mantenha-os coerentes para que os indicadores fechem.

---

## 5. Testar antes de publicar

Na pasta do projeto, rode um servidor local e abra o endereço indicado:

```bash
# Python (já vem instalado no macOS e na maioria dos Linux)
python3 -m http.server 8080

# ou, com Node.js instalado
npx serve .
```

Depois acesse <http://localhost:8080>.

---

## 6. Observações

- **Privacidade:** os dados ficam no arquivo JSON do repositório. Em repositório público, qualquer pessoa com o endereço consegue vê-los. Para uso interno, prefira repositório privado (requer plano Team/Enterprise para o Pages) ou outra hospedagem com senha.
- **Preferências locais:** tema claro/escuro, favoritos, alertas dispensados e decisões registradas ficam salvos no próprio navegador de cada usuário (`localStorage`), não no repositório.
- **Importação de Excel** (aba *Gestão 360*) usa a biblioteca SheetJS via CDN; essa função específica precisa de internet na primeira vez.
