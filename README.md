# Sistema de Empréstimo de Equipamentos — Laboratório

Controle de empréstimo e devolução de equipamentos de laboratório, operado por um técnico no balcão. Registra quem está com cada equipamento, bloqueia alunos com devolução vencida e produz o relatório de atrasos.

Trabalho 1 — Engenharia de Software. As decisões de projeto e as lacunas do pedido original estão em [`DECISOES.md`](./DECISOES.md).

## Stack

- **Front-end:** React 19 + TanStack Start (SSR) + TanStack Router + TanStack Query
- **Estilo:** Tailwind CSS 4 + componentes shadcn/ui
- **Back-end:** Supabase (PostgreSQL + Auth). As regras de negócio estão em funções PL/pgSQL, não no cliente.
- **Build:** Vite 8

## Funcionalidades

- Painel com equipamentos emprestados, atrasos em aberto, alunos pendentes e itens disponíveis
- Registro de empréstimo com aviso de pendência antes da seleção do equipamento
- Registro de devolução com condição (`OK` / `AVARIADO`)
- Listagem de empréstimos com filtros (em aberto, atrasados, todos), cancelamento com motivo e marcação de extravio
- Relatório de atrasos com exportação CSV, impressão e sinalização de possível extravio
- Cadastro e histórico de alunos e equipamentos
- Trilha de auditoria e reinicialização dos dados de demonstração

## Regras implementadas

| Regra | Valor |
|---|---|
| Prazo padrão | 7 dias corridos, editável pelo técnico (1 a 30) |
| Vencimento | ao fim do dia de `previsto_para`; atraso começa no dia seguinte |
| Pendência | pelo menos um empréstimo em aberto com data prevista já passada |
| Tolerância | zero — 1 dia de atraso já bloqueia |
| Extinção da pendência | imediata, no ato da devolução |
| Limite por aluno | 3 empréstimos simultâneos em aberto |
| Fuso horário | `America/Fortaleza`, fixo |
| Multa | não existe |

Códigos de recusa retornados pelo sistema: `PENDENCIA`, `LIMITE_EXCEDIDO`, `INDISPONIVEL`, `ALUNO_INATIVO`, `PRAZO_INVALIDO`, `JA_DEVOLVIDO`, `JA_CANCELADO`, `MOTIVO_OBRIGATORIO`, `NAO_EM_ABERTO`.

**Concorrência:** a exclusão mútua não depende da leitura do status do equipamento. Existe um índice único parcial em `emprestimos (equipamento_id) WHERE devolvido_em IS NULL AND cancelado_em IS NULL`; `fn_emprestar` captura a violação e responde `INDISPONIVEL`. Dois técnicos registrando o mesmo patrimônio ao mesmo tempo nunca produzem dois empréstimos abertos.

---

## Executando em outra máquina

### Pré-requisitos

- Node.js 20 ou superior ([nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Conta gratuita no [Supabase](https://supabase.com)

### 1. Clonar e instalar

```sh
git clone <url-do-repositorio>
cd <pasta-do-projeto>
npm install
```

### 2. Criar o projeto Supabase

Crie um projeto novo em [supabase.com/dashboard](https://supabase.com/dashboard). Anote a região e a senha do banco.

### 3. Aplicar o esquema

No painel do Supabase, abra **SQL Editor** e execute o conteúdo dos arquivos de `supabase/migrations/`, **na ordem dos nomes** (a primeira cria tabelas, RLS e funções; a segunda ajusta permissões):

1. `20260811192010_*.sql`
2. `20260811192031_*.sql`

Se preferir a CLI do Supabase: `supabase link --project-ref <ref>` seguido de `supabase db push`.

### 4. Configurar as variáveis de ambiente

Copie `.env.example` para `.env` e preencha com os dados de **Project Settings → API** do seu projeto:

```
SUPABASE_PROJECT_ID="<seu-project-id>"
SUPABASE_PUBLISHABLE_KEY="<sua-publishable-key>"
SUPABASE_URL="https://<seu-project-id>.supabase.co"
VITE_SUPABASE_PROJECT_ID="<seu-project-id>"
VITE_SUPABASE_PUBLISHABLE_KEY="<sua-publishable-key>"
VITE_SUPABASE_URL="https://<seu-project-id>.supabase.co"
```

### 5. Executar

```sh
npm run dev
```

A aplicação sobe em `http://localhost:5173`.

### 6. Criar o usuário técnico

Na tela de login, preencha `tecnico@lab.edu.br` e `lab123456` e use o link **"Primeiro acesso: criar o usuário técnico com estes dados"**. O acesso é feito automaticamente em seguida.

> Alternativa recomendada em uso real: criar o usuário em **Authentication → Users** no painel do Supabase e desativar o cadastro público em **Authentication → Providers → Email → Allow new users to sign up**. O cadastro aberto é uma decisão da ferramenta de IA, registrada e discutida na seção 4.1 do `DECISOES.md`.

### 7. Carregar os dados de demonstração

Acesse `/admin`, digite `RESETAR` no campo de confirmação e acione a reinicialização. Isso apaga tudo e recria a base abaixo, com datas calculadas em relação ao dia da execução — o estado é idêntico em qualquer máquina e em qualquer data.

**Alunos**

| Matrícula | Nome | Situação |
|---|---|---|
| 2021001 | Ana Souza | 1 empréstimo vencido há 1 dia (`EQ-001`) |
| 2021002 | Bruno Lima | 1 empréstimo em dia, vence em 5 dias (`EQ-002`) |
| 2021003 | Carla Dias | 3 empréstimos em aberto e em dia (`EQ-003`, `EQ-004`, `EQ-005`) |
| 2021004 | Diego Rocha | sem empréstimos |
| 2021005 | Elisa Nunes | inativa |

**Equipamentos**

`EQ-001` a `EQ-005` emprestados conforme a tabela acima · `EQ-006`, `EQ-007`, `EQ-008` disponíveis · `EQ-009` em manutenção.

---

## Executando os critérios de aceite

Os três critérios do `DECISOES.md` partem do estado recém-reinicializado do passo 7.

**1. Bloqueio por pendência.** Em `/emprestimos/novo`, buscar a matrícula `2021001`, selecionar `EQ-006` e confirmar.
→ Recusa com o código `PENDENCIA`. Em `/emprestimos` filtro "Todos", continuam 5 linhas. `EQ-006` segue Disponível.

**2. Bloqueio por limite.** Em `/emprestimos/novo`, buscar a matrícula `2021003`, selecionar `EQ-006` e confirmar.
→ Recusa com o código `LIMITE_EXCEDIDO`. Continuam 5 linhas. `EQ-006` segue Disponível.

**3. Devolução repetida.** Em `/devolucao`, devolver `EQ-002` com condição `OK`. Depois, em `/emprestimos` filtro "Todos", tentar devolver a mesma linha novamente.
→ A primeira é aceita e `EQ-002` passa a Disponível. A segunda é recusada com `JA_DEVOLVIDO`, e a data e hora da devolução permanecem as da primeira.

---

## Estrutura do projeto

```
src/
  routes/                  páginas (login, painel, empréstimos, devolução, atrasos, alunos, equipamentos, admin)
  components/              AppShell, componentes de UI
  lib/dominio.ts           parâmetros e cálculos de data usados na interface
  integrations/supabase/   cliente e tipos gerados
supabase/
  migrations/              esquema, políticas RLS e funções de negócio
```

As operações que alteram estado passam por funções do banco (`fn_emprestar`, `fn_devolver`, `fn_cancelar`, `fn_marcar_extravio`, `fn_alterar_status_equipamento`, `fn_reset_demo`), chamadas via RPC. Todas registram na tabela `auditoria` e retornam `{ ok, codigo, mensagem }`.

## Scripts

| Comando | Efeito |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run preview` | pré-visualiza o build |
| `npm run lint` | ESLint |

## Autores

`<nome 1>` e `<nome 2>`
