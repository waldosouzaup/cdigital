# Comitê Digital — Design System

> **Documento de referência.** É o padrão único para toda evolução visual do
> sistema. Toda UI nova ou alterada deve seguir daqui: cores, tipografia,
> espaçamento, estados e componentes. Se algo não está aqui, **primeiro** se
> adiciona a este documento (com revisão), **depois** ao código.

- **Base**: identidade visual "Comitê Digital" (marca `cd•` + wordmark).
- **Direção**: claro por padrão, verde como cor de ação/progresso, lime como
  acento de energia, tipografia geométrica, superfícies limpas com hairlines.
- **Implementação**: tokens em `src/app/globals.css` (`:root` + `@theme inline`,
  Tailwind v4). Componentes consomem **tokens semânticos**, nunca hex cru.

> ⚠️ Os valores hex abaixo foram **derivados das artes da marca** (infográficos +
> logo). Antes de aplicar em produção, confirme contra o arquivo oficial da marca
> e ajuste os tokens primitivos — os **papéis** (o que cada cor significa) não
> mudam, só os valores exatos.

---

## 1. Princípios

1. **Verde é ação e andamento.** Botão primário, ícones positivos, barras de
   gráfico, estado "assinado/encerrado", foco. Progresso é sempre verde.
2. **Lime é acento, nunca corpo.** Só nos "brilhos" da marca, um único destaque
   por tela, detalhes de energia. Contraste baixo demais para texto ou UI
   essencial — **decoração apenas**.
3. **Claro é canônico.** A referência é o tema claro. Se houver tema escuro, ele
   é uma tradução de papéis (§9), não uma identidade própria.
4. **Cor nunca sozinha.** Todo estado carrega **ícone + rótulo** além da cor
   (ex.: distrato = ✕ vermelho + texto "Distrato"). Daltônico e print P&B leem
   igual.
5. **Dado em mono, texto em proporcional.** CPF, valor, data/hora, identificador,
   estado, token → fonte monoespaçada. Texto escrito por gente → proporcional.
   (Convenção já existente; mantida.)
6. **Institucional, não SaaS genérico.** Comitê lida com contrato, documento e
   prazo. Seriedade: um acento por vez, hairline em vez de sombra pesada,
   sem gradiente decorativo.

---

## 2. Cor — tokens primitivos (a paleta crua)

Não usar diretamente na UI. Servem só para compor os **tokens semânticos** (§3).

### Verde (primária)

| Token | Hex | Uso típico |
|---|---|---|
| `green-50`  | `#F1F9F4` | tinte de página / faixa de destaque muito suave |
| `green-100` | `#DDF3E6` | chip/badge de fundo, círculo atrás de ilustração |
| `green-200` | `#BFE8D0` | estado "enviado", preenchimento fraco |
| `green-300` | `#8FD9AE` | 2ª série de gráfico |
| `green-400` | `#54C98C` | ícones, marcadores |
| `green-500` | `#2FBF83` | **base da marca** (o `cd`), preenchimentos, gráfico série 1 |
| `green-600` | `#1FA871` | hover/pressed de superfícies verdes |
| `green-700` | `#157F58` | **texto verde sobre claro**, botão sólido (contraste AA) |
| `green-800` | `#0F5F42` | estado "encerrado", ênfase máxima |
| `green-900` | `#0C1512` | quase-preto de headings (com leve cast verde) |

### Lime (acento)

| Token | Hex | Uso |
|---|---|---|
| `lime-300` | `#D6E85F` | brilho/sparkle claro |
| `lime-400` | `#C4D830` | **acento da marca** (o `•` do logo), 1 destaque por tela |
| `lime-500` | `#AEC426` | acento sobre fundo claro quando `lime-400` some |

> Nunca: texto em lime, borda essencial em lime, botão primário em lime.

### Neutros (ink / cinza / superfícies)

| Token | Hex | Uso |
|---|---|---|
| `ink-900` | `#0C1512` | headings de alto peso |
| `ink-800` | `#14211C` | **texto primário** (corpo, títulos padrão) |
| `ink-600` | `#3C4A44` | texto forte secundário |
| `ink-500` | `#5E6B78` | **texto atenuado** (legendas, metadados, "digital" do logo) |
| `ink-400` | `#8A98A0` | placeholder, texto desabilitado |
| `neutral-200` | `#CDD5CD` | borda forte, divisor de tabela |
| `neutral-150` | `#E2E7E1` | **hairline** padrão |
| `neutral-100` | `#EEF1EE` | fundo de estado "rascunho/cancelado", inset |
| `surface-tint` | `#E9F5EE` | círculo/realce suave (ilustrações) |
| `surface-sunken` | `#F1F4F0` | cabeçalho de tabela, faixa recuada |
| `canvas` | `#F6F8F5` | **fundo da página** (off-white com leve verde) |
| `white` | `#FFFFFF` | superfície de card, input, modal |

### Semânticas de status (primitivas)

| Token | Hex | Significado |
|---|---|---|
| `positive-500` | `#1FA871` | sucesso / aprovado / apto (alinhado ao verde da marca) |
| `positive-100` | `#DDF3E6` | fundo de alerta de sucesso |
| `warning-500` | `#E0A32E` | atenção / pendência documental |
| `warning-100` | `#FBEFD6` | fundo de alerta de atenção |
| `danger-500` | `#E5533D` | negativo / rejeitado / distrato / cancelamento |
| `danger-100` | `#FCE7E2` | fundo de alerta crítico |
| `info-500` | `#2F80B5` | informativo neutro (uso restrito — verde é a ação) |
| `info-100` | `#E3EFF6` | fundo de alerta informativo |
| `muted-500` | `#94A3A0` | "pendente" no donut, estado neutro/indefinido |

---

## 3. Cor — tokens semânticos (o que a UI usa)

Estes são os nomes que aparecem no código (`bg-…`, `text-…`, `border-…`). Mapeiam
para os primitivos e trocam de valor entre claro/escuro.

| Token semântico | Papel | Claro → primitivo |
|---|---|---|
| `--color-canvas` | fundo da aplicação | `canvas` `#F6F8F5` |
| `--color-surface` | card, painel, input, modal | `white` |
| `--color-surface-sunken` | cabeçalho de tabela, inset | `surface-sunken` |
| `--color-surface-tint` | realce suave / círculo de ícone | `surface-tint` |
| `--color-ink` | texto primário | `ink-800` |
| `--color-ink-strong` | heading de peso | `ink-900` |
| `--color-ink-muted` | texto secundário / metadados | `ink-500` |
| `--color-ink-subtle` | placeholder / desabilitado | `ink-400` |
| `--color-ink-on-primary` | texto sobre preenchimento verde | `white` |
| `--color-line` | hairline padrão | `neutral-150` |
| `--color-line-strong` | divisor de tabela, borda ativa | `neutral-200` |
| `--color-primary` | **ação**: botão, link, ícone ativo, texto verde | `green-700` |
| `--color-primary-base` | preenchimento de marca, gráfico, faixa | `green-500` |
| `--color-primary-hover` | hover/pressed | `green-600` |
| `--color-primary-tint` | fundo de item ativo, chip verde | `green-100` |
| `--color-accent` | 1 destaque por tela, brilhos da marca | `lime-400` |
| `--color-focus` | anel de foco | `green-600` |
| `--color-success` / `-tint` | sucesso | `positive-500` / `positive-100` |
| `--color-warning` / `-tint` | atenção | `warning-500` / `warning-100` |
| `--color-danger` / `-tint` | crítico / negativo | `danger-500` / `danger-100` |
| `--color-info` / `-tint` | informativo | `info-500` / `info-100` |
| `--color-neutral-status` | estado neutro/indefinido | `muted-500` |

**Regra:** nenhum componente referencia primitivo ou hex. Só semântico.
Se falta um papel, adicione um semântico aqui — não faça `bg-[#...]`.

---

## 4. Cor por estado de domínio

### 4.1 Ciclo de vida do contrato (`status_contrato`)

Espelha o infográfico "Gestão contratual": neutro → verde crescente → verde
sólido; negativos em vermelho; sempre com ícone.

| Status | Fundo | Texto | Ícone | Peso visual |
|---|---|---|---|---|
| `rascunho` | `neutral-100` | `ink-muted` | ○ | neutro, não conta no quadro ativo |
| `emitido` | `primary-tint` (`green-100`) | `green-800` | ▸ | positivo inicial |
| `enviado` | `green-200` | `green-800` | ➤ | positivo em curso |
| `assinado` | `primary-base` (`green-500`) | `ink-on-primary` | ✓ | **positivo forte** (preenchido) |
| `encerrado` | `green-800` | `white` | ✓✓ | terminal de sucesso |
| `distratado` | `danger-tint` | `danger-500` (texto `#B23A2B`) | ✕ | negativo |
| `distrato_assinado` | `danger-tint` | `#B23A2B` | ✕ | negativo arquivado |
| `cancelado` | `neutral-100` | `ink-muted` (riscado) | ✕ | encerramento sem efeito |

### 4.2 Documento (`status_documento`) e Pessoa

| Estado | Cor semântica | Ícone |
|---|---|---|
| documento `pendente` | `warning` | ⧗ |
| documento `aprovado` | `success` | ✓ |
| documento `rejeitado` | `danger` | ✕ |
| pessoa `apta` | `success` | ✓ |
| pessoa não apta / com pendência | `warning` | ! |
| autoinscrito aguardando triagem | `warning` (faixa/badge) | ⬦ |

### 4.3 Dataviz (dashboard)

Segue o donut "Status geral" do infográfico.

| Série | Cor |
|---|---|
| Em dia / concluído | `primary-base` `#2FBF83` |
| Atenção | `warning` `#E0A32E` |
| Pendente | `neutral-status` `#94A3A0` |

Para gráficos multi-série (barras, matriz): **verde-dominante**, nesta ordem —
`green-500`, `green-300`, `ink-500` (cinza), `warning-500`, `lime-500`. Nunca
mais de um lime no mesmo gráfico. Escala sequencial (mapa de calor de cobertura):
`green-100 → green-300 → green-500 → green-800`.

---

## 5. Tipografia

A tipografia oficial e padronizada em todo o projeto é a família **Inter** para títulos e corpo de texto, combinada com a **IBM Plex Mono** para dados verificáveis:

| Papel | Família | Observação |
|---|---|---|
| Display / Headings | **Inter** (`--font-inter` / `--font-sans`) | peso 600 (semibold), 700 (bold), 800 (extrabold), 900 (black) |
| Corpo / UI | **Inter** (`--font-inter` / `--font-sans`) | peso 400 (regular), 500 (medium) |
| Dado verificável | **IBM Plex Mono** (`--font-plex-mono` / `--font-mono`) | CPF, valor, data/hora, id, estado, token (pesos 400, 500, 600, 700) |

### Escala (mantida)

| Token | Tamanho | Uso |
|---|---|---|
| `--text-display` | `clamp(2.5rem, 1.6rem + 4vw, 4.25rem)` | landing / marca |
| `--text-h1` | `1.75rem` | título de página |
| `--text-h2` | `1.25rem` | seção |
| `--text-body` | `1rem` | corpo |
| `--text-small` | `0.875rem` | apoio, labels |
| `--text-register` | `0.8125rem` | linha de registro / metadado mono |

- Largura de leitura: `--measure: 66ch`.
- Números tabulares (`tabular-nums`) em toda coluna numérica e KPI.
- Título nunca em CAIXA ALTA decorativa; `letter-spacing` só em rótulos mono
  pequenos (`tracking-wider`, `uppercase`, `text-xs`).

---

## 6. Espaçamento, raio, borda, elevação

- **Grid base 4px** (escala Tailwind padrão). Densidade de painel: `p-4`/`p-6`
  em cards, `gap-3`/`gap-4` em grades.
- **Raio**

  | Token | Valor | Uso |
  |---|---|---|
  | `--radius-sm` | `0.25rem` | tag pequena |
  | `--radius-md` | `0.375rem` | **input**, célula |
  | `--radius-lg` | `0.5rem` | **botão** padrão |
  | `--radius-xl` | `0.75rem` | **card** |
  | `--radius-2xl` | `1rem` | card destaque, modal |
  | `--radius-full` | `9999px` | **chip / badge / status / avatar** |

- **Borda**: hairline `1px solid var(--color-line)` é o separador padrão do tema
  claro (preferir a sombra). Item ativo/seleção: `2px` ou borda-esquerda `3px` em
  `--color-primary`.
- **Elevação** (tema claro usa sombra suave, ao contrário do escuro):

  | Token | Uso |
  |---|---|
  | `--shadow-card` | card em repouso (quase imperceptível) |
  | `--shadow-elevation` | card em hover / popover |
  | `--shadow-dropdown` | menu, combobox |
  | `--shadow-modal` | diálogo |

  Remover `--shadow-gold` (era do acento dourado).

---

## 7. Componentes

Mapeamento para os componentes existentes em `src/components/`. A **API dos
componentes não muda** — muda o que cada variante pinta.

### 7.1 Botão — `Selo` (`voz`)

| `voz` | Aparência | Quando |
|---|---|---|
| `selo` / `primary` | preenchido `primary` (`green-700`), texto `ink-on-primary`, hover `primary-hover` | ação principal da tela (1 por contexto) |
| `verde` / `secundario` | contorno `1px` `primary`, texto `primary`, fundo `surface`; hover `primary-tint` | ação secundária |
| `linha` / `ghost` | sem fundo, texto `ink`, hover `surface-sunken` | ação terciária, "Cancelar" |
| `destaque` (era `amarelo`) | preenchido `accent` (`lime-400`), texto `ink-strong` | **raríssimo** — um CTA de campanha que precisa saltar. Não é o padrão. |
| `perigo` | preenchido `danger`, texto branco | ação destrutiva confirmada (distrato, expurgo) |
| `neutro` | fundo `neutral-100`, texto `ink-muted` | ação de baixa ênfase |

Estados: `:hover` escurece 1 passo; `:focus-visible` → anel `--color-focus`
(2px, offset 2px); `:disabled` → `opacity: 0.5`, cursor default; `carregando` →
spinner + `textoCarregando`, desabilitado.

### 7.2 Campo — `Campo` / `Campo.Area` / `Campo.Selecao`

- Fundo `surface`, borda inferior/box `line`, texto `ink`, placeholder
  `ink-subtle`.
- **Foco**: borda `primary` + anel `--color-focus` sutil.
- **Erro**: borda `danger`, texto de ajuda `danger`, `aria-invalid`. O texto do
  erro explica e aponta a saída (nunca só "inválido").
- `mono` para campos de dado (CPF, valor, agência/conta, token).
- Rótulo sempre visível acima; `auxiliar` abaixo em `ink-muted`.

### 7.3 Selo de status — `Badge`

- Formato `--radius-full`, `text-xs`, `font-medium`, padding `px-2 py-0.5`.
- Cor pela tabela §4. Sempre com ícone + rótulo.
- `rotuloPersonalizado` para textos fora do enum.

### 7.4 Alerta — `Alerta` (`tom`)

| `tom` | Fundo | Borda/Título | Ícone |
|---|---|---|---|
| `informativo` | `info-tint` | `info` | ℹ |
| `sucesso` | `success-tint` | `success` | ✓ |
| `atencao` | `warning-tint` | `warning` | ▲ |
| `critico` | `danger-tint` | `danger` | ✕ |

`role="alert"` só em `critico`; senão `role="status"`. Fundo é **tinte pálido**,
nunca cor saturada em bloco grande.

### 7.5 Modal — `Modal`

- Superfície `surface`, `--radius-2xl`, `--shadow-modal`.
- Backdrop `color-mix(in srgb, var(--color-ink) 50%, transparent)` + blur leve.
- Ação primária = `Selo voz="selo"` (ou `perigo`); secundária = `voz="linha"`.
- Fecha em Esc e clique no backdrop.

### 7.6 Estado vazio — `EstadoVazio`

- Ícone/glifo em `ink-subtle` dentro de círculo `surface-tint`.
- Título `ink`, descrição `ink-muted`, `acao` opcional (`Selo voz="verde"`).

### 7.7 Navegação / casca do painel — `(painel)/layout.tsx`

> Hoje usa hex de tema escuro fixo (`#070d18`, `#0c1628`, `#162540`). **Migrar
> para tokens claros.**

- Sidebar: fundo `surface`, borda `line`.
- Item ativo: borda-esquerda `3px` `primary`, fundo `primary-tint`, texto
  `primary`, peso 600. (Era `brand-yellow`.)
- Item inativo: texto `ink-muted`; hover → fundo `surface-sunken`, texto `ink`.
- Topbar: fundo `surface`, `sticky`, hairline inferior; selo "RLS ativo" em
  `success` (tinte).
- O nome/papel do usuário no topo deve vir das claims reais (hoje é placeholder
  "Maria Salgado").

### 7.8 Régua de registro — `.regua`

- `border-left: 2px solid` — trocar `--rule-margin` (era dourado) para
  `color-mix(in srgb, var(--color-primary) 45%, transparent)`.

### 7.9 Marca — `Marca`

- Fonte única da identidade: `cd` (ligadura verde `green-500`) + `•`
  (`accent`/`lime-400`) + wordmark "comitê" (`ink-800`) / "digital" (`ink-500`).
- Não recolorir, não distorcer, não adicionar sombra.
- Clearspace ≥ altura do `d`. Tamanho mínimo do lockup: 96px de largura.
- Sobre fundo escuro (raro): wordmark inverte para `ink-on-primary`; a marca
  `cd` permanece `green-500`.

---

## 8. Gráficos — `src/components/graficos/*`

- Barras: `primary-base`; barra em foco/hover: `primary-hover`.
- Funil: verde do topo (largo) ao verde escuro (estreito) — `green-300 → green-800`.
- Orçamento / metas: preenchido `primary-base`, trilho `neutral-100`.
- Sparkline: linha `primary`, área `primary-tint` a 40% de opacidade.
- Rótulo de eixo/valor: `ink-muted`, mono, `tabular-nums`.
- **Lacuna de dado** ("não informado", caso Taguatinga): rótulo textual explícito
  em `ink-muted`, **nunca** 0 nem barra vazia colorida.

---

## 9. Tema claro / escuro

- **Claro é o padrão e a referência.** Todo mock, print e material de marca é
  claro.
- Hoje o app **força `data-theme="dark"`** (`src/app/layout.tsx` + commit
  `fix(tema)`). Adotar este design system implica **remover a força** e tornar
  claro o default (migração, fora do escopo deste documento).
- Se um tema escuro for mantido, ele **traduz papéis**, não inventa cor:

  | Semântico | Escuro |
  |---|---|
  | `canvas` | `#0E1613` |
  | `surface` | `#14201C` |
  | `surface-sunken` | `#1B2A25` |
  | `ink` | `#EAF2EC` |
  | `ink-muted` | `#9DB0A8` |
  | `line` | `#26332E` |
  | `primary` (texto/ação) | `#3ED18C` (elevado p/ contraste) |
  | `primary-base` | `#2FBF83` |
  | `accent` | `#C4D830` (inalterado — acento) |
  | `success/warning/danger` | versões +1 de luminância dos primitivos |

- Definir cada cor sempre no `:root` base; redefinir só os tokens sob
  `@media (prefers-color-scheme: dark)` (guardado por
  `:root:not([data-theme="light"])`) e sob `:root[data-theme="dark"]`.

---

## 10. Acessibilidade (obrigatório)

- **Contraste**: corpo ≥ 4.5:1 (WCAG AA); texto grande e componentes/bordas ≥ 3:1.
  - `green-700` `#157F58` sobre branco ≈ 5:1 → **ok para texto**.
  - `green-500` `#2FBF83` sobre branco ≈ 3:1 → **só ícone/gráfico/borda**, não texto.
  - Botão sólido verde: usar `green-700` de fundo + texto branco (≈ 5:1).
  - **Lime**: nunca texto, nunca borda essencial.
- **Nunca cor sozinha**: estado sempre com ícone + rótulo (§1.4).
- **Foco visível sempre**: `outline: 2px solid var(--color-focus); outline-offset: 2px`
  em todo elemento interativo. Não remover `:focus-visible`.
- **Alvo de toque** ≥ 44×44px na UI de campo (`/atividades`, `/coleta`).
- **Movimento**: respeitar `prefers-reduced-motion` (sem animação de entrada de
  card, sem pulse decorativo).
- Ícone decorativo → `aria-hidden`; ícone que carrega significado → `aria-label`.

---

## 11. Implementação — mapa "agora → alvo"

Alterar em `src/app/globals.css`. **Não** tocar componente por componente antes
de os tokens estarem certos.

| Token | Valor atual | Valor alvo (claro) |
|---|---|---|
| `--color-paper` → renomear p/ `--color-canvas` | `#eceeeb` (forçado escuro `#070d18`) | `#F6F8F5` |
| `--color-surface` | `#f5f6f4` / `#0d1728` | `#FFFFFF` |
| *(novo)* `--color-surface-sunken` | — | `#F1F4F0` |
| *(novo)* `--color-surface-tint` | — | `#E9F5EE` |
| `--color-ink` | `#1b2430` | `#14211C` |
| *(novo)* `--color-ink-strong` | — | `#0C1512` |
| `--color-ink-muted` | `#5b6472` | `#5E6B78` |
| *(novo)* `--color-ink-subtle` | — | `#8A98A0` |
| `--color-seal` → **conceito muda**: acento primário passa a ser verde | `#ffcc00` (ouro) | *(deprecar; ver `--color-primary`)* |
| *(novo)* `--color-primary` | — | `#157F58` |
| *(novo)* `--color-primary-base` | — | `#2FBF83` |
| *(novo)* `--color-primary-hover` | — | `#1FA871` |
| *(novo)* `--color-primary-tint` | — | `#DDF3E6` |
| *(novo)* `--color-accent` | — | `#C4D830` |
| *(novo)* `--color-focus` | *(outline dourado)* | `#1FA871` |
| `--color-line` | `#d4d2c9` | `#E2E7E1` |
| `--color-line-subtle` → `--color-line-strong` (inverte papel) | `#e2e0d7` | `#CDD5CD` |
| `--color-success` | `#009c3b` | `#1FA871` |
| `--color-warning` | `#f59e0b` | `#E0A32E` |
| `--color-alert` → renomear `--color-danger` | `#dc2626` | `#E5533D` |
| `--color-info` | `#0284c7` | `#2F80B5` |
| *(novo)* `*-tint` de success/warning/danger/info | — | `#DDF3E6` / `#FBEFD6` / `#FCE7E2` / `#E3EFF6` |
| *(novo)* `--color-neutral-status` | — | `#94A3A0` |
| `--color-brand-yellow*`, `--color-brand-navy`, `--color-brand-blue`, `--color-brand-green*` (paleta bandeira) | — | **deprecar**. Substitutos: `--color-primary*`, `--color-accent`, `--color-ink-strong` |
| `--rule-margin` | `mix(brand-yellow 60%)` | `color-mix(in srgb, var(--color-primary) 45%, transparent)` |
| `--shadow-gold` | presente | **remover** |
| `--font-*` | Inter / Plex Mono | família Inter padronizada em todo o projeto |
| `:focus-visible` outline | `var(--color-brand-yellow)` | `var(--color-focus)` |
| `<html>` | `data-theme="dark"` fixo | remover a força; claro é o default |

Depois de trocar os tokens, varrer:
`grep -rE "#[0-9a-fA-F]{3,6}" src/app src/components` — nenhum hex cru deve
sobrar em componente (exceto `globals.css`).
Substituir `brand-yellow`/`brand-navy`/`seal` nos componentes e no
`(painel)/layout.tsx`.

---

## 12. Governança — como este documento evolui

1. **Mudança de token/valor**: PR editando `globals.css` **e** este documento na
   mesma mudança. Descrever o papel afetado, não só o hex.
2. **Novo componente**: adicionar uma seção em §7 (aparência por estado: repouso,
   hover, foco, desabilitado, erro) antes de mergear o componente.
3. **Novo estado de domínio**: adicionar à tabela §4 com **cor + ícone + rótulo**.
4. **Checklist de PR de UI**:
   - [ ] usa só tokens semânticos (sem hex, sem primitivo)
   - [ ] contraste AA verificado (texto e componentes)
   - [ ] `:focus-visible` presente e visível
   - [ ] estado não depende só de cor (ícone + rótulo)
   - [ ] papel para tema escuro definido, se o escuro for mantido
   - [ ] `prefers-reduced-motion` respeitado
5. **Fonte da verdade da marca**: o componente `Marca`. Logo não é reimplementado
   em SVG solto.

---

*Comitê Digital — tecnologia aplicada à conformidade, transparência e eficiência
operacional.*
