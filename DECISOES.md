# DECISÕES

Sistema de empréstimo de equipamentos do laboratório
Trabalho 1 — Engenharia de Software

> **Antes de entregar:** preencha os campos marcados com `<...>` (nomes da dupla, horas, ferramenta de IA usada) e confira se as decisões abaixo continuam correspondendo ao código entregue.

Dupla: `Ana Luiza Soares` e `Ana Vírna Carvalho`
Repositório: `https://github.com/Ana14Soares/pixel-perfect-view-985.git`

---

## 1. Decisões assumidas

### 1.1 Unidade do equipamento

O pedido não especifica se "os equipamentos do laboratório" são unidades individuais ou tipos com quantidade em estoque. Assumimos que **cada equipamento é uma unidade física individual, identificada por um número de patrimônio único** (`equipamentos.patrimonio text NOT NULL UNIQUE`). Dois multímetros idênticos são duas linhas distintas (`EQ-001` e `EQ-006`).

Se o cliente esperasse controle por quantidade ("temos 5 multímetros, 3 estão fora"), o impacto seria: substituir a chave de negócio `patrimonio` por `tipo + quantidade_total`, o que invalida todos os registros existentes de `equipamentos`; trocar a FK `emprestimos.equipamento_id` por uma referência ao tipo mais um campo de quantidade; **remover o índice único parcial `emprestimos_equipamento_aberto_uniq`**, que é o mecanismo de exclusão mútua, e substituí-lo por um controle de saldo com bloqueio de linha, porque uma constraint de unicidade não expressa "no máximo N simultâneos"; e reescrever as telas de devolução e de histórico, que hoje localizam o empréstimo pelo patrimônio e passariam a não conseguir dizer qual unidade voltou.

### 1.2 Origem e unidade do prazo

O pedido diz apenas que o aluno "devolve depois" e pede um relatório de atrasos — mas nunca define prazo, e sem prazo o conceito de atraso não existe. Assumimos **prazo padrão de 7 dias corridos, sugerido pelo sistema e editável pelo técnico no ato do empréstimo, limitado a 1–30 dias** (`PRAZO_PADRAO_DIAS = 7` em `src/lib/dominio.ts`; validação `PRAZO_INVALIDO` em `fn_emprestar`).

Se o cliente esperasse prazo por categoria de equipamento (osciloscópio 3 dias, ferramenta manual 15), o impacto seria: acrescentar `prazo_dias` à tabela `equipamentos` com valor obrigatório para todo item já cadastrado; mover o cálculo de `previsto_para` do formulário para dentro de `fn_emprestar`, que hoje recebe a data pronta do cliente; e decidir o que fazer com os empréstimos já registrados sob a regra antiga, já que o relatório de atrasos passaria a comparar registros calculados por critérios diferentes.

### 1.3 Dias corridos, e não dias úteis

O pedido não menciona calendário. Assumimos **dias corridos**: fins de semana e feriados contam (`diffDias` em `src/lib/dominio.ts` e `hoje_local() - previsto_para` no banco).

Se o cliente esperasse dias úteis, o impacto seria: criar uma tabela de feriados com manutenção anual (municipal, estadual, federal e calendário acadêmico) e substituir a subtração de datas por uma função de contagem em `hoje_local()`, `aluno_pendencia()` e `diasAtraso()`. Sem essa tabela a regra não é implementável, e ela é dado que o cliente teria de fornecer — não é derivável do sistema.

### 1.4 Momento exato do vencimento

O pedido não diz a partir de que instante um empréstimo está atrasado. Assumimos que **`previsto_para` é uma data (não um horário) e o empréstimo só vence ao fim daquele dia**: devolver às 23h59 da data prevista está em dia; a pendência começa no dia seguinte (`previsto_para < hoje_local()`).

Se o cliente esperasse vencimento por horário ("devolver até as 17h, junto com o fechamento do laboratório"), o impacto seria: mudar o tipo da coluna `previsto_para` de `date` para `timestamptz`, o que exige converter todos os registros existentes escolhendo arbitrariamente um horário para eles; e trocar todas as comparações de data por comparações de instante em `fn_emprestar`, `aluno_pendencia`, no relatório de atrasos e no filtro "atrasados" da listagem.

### 1.5 Definição de pendência

"Aluno com pendência não pode pegar mais nada" é a única regra explícita do pedido, e ela usa um termo que o pedido não define. Assumimos a definição mais restrita possível: **está pendente o aluno que possui ao menos um empréstimo em aberto cuja data prevista já passou** (`aluno_pendencia()`). Equipamento avariado, histórico de atrasos passados e equipamento extraviado já baixado não geram pendência por si.

Se o cliente esperasse que avaria ou histórico de reincidência também bloqueassem, o impacto seria: `aluno_pendencia()` deixaria de ser uma consulta sobre empréstimos em aberto e passaria a precisar de uma tabela própria de pendências com origem, data de abertura e responsável pela baixa — porque uma avaria não se resolve sozinha com a devolução, alguém precisa declarar que foi resolvida. Isso acrescenta um fluxo de quitação que hoje não existe em nenhuma tela.

### 1.6 Tolerância zero e extinção imediata da pendência

O pedido não indica prazo de carência nem duração do bloqueio. Assumimos **tolerância zero** (1 dia de atraso já bloqueia) e **extinção instantânea**: a pendência desaparece no momento em que o aluno devolve, sem suspensão posterior.

Se o cliente esperasse suspensão punitiva (por exemplo, bloqueio por 15 dias após regularizar, ou 2 dias de bloqueio por dia de atraso), o impacto seria: criar uma tabela `suspensoes` com data de início e fim, porque essa informação não é derivável dos empréstimos existentes — o sistema hoje não guarda em que dia cada devolução atrasada foi regularizada de modo a projetar um bloqueio futuro; e acrescentar essa verificação como novo passo em `fn_emprestar`, com um código de erro distinto de `PENDENCIA`, já que "está atrasado agora" e "está de castigo" são recusas diferentes para o operador.

### 1.7 Limite de empréstimos simultâneos

O pedido não estabelece limite; "não pode pegar mais nada" fala apenas de quem tem pendência. Assumimos **máximo de 3 empréstimos em aberto por aluno** (`LIMITE_EMPRESTIMOS = 3`, verificado em `fn_emprestar` com o código `LIMITE_EXCEDIDO`).

Se o cliente esperasse limite por categoria ("só um osciloscópio por vez") ou nenhum limite, o impacto seria: no primeiro caso, a contagem em `fn_emprestar` passaria de um `COUNT(*)` simples para uma contagem agrupada por categoria, exigindo uma tabela de limites por categoria mantida pela coordenação; no segundo, o passo sairia da função e a mensagem `LIMITE_EXCEDIDO` desapareceria da interface — o que quebraria nosso critério de aceite nº 2.

### 1.8 Dois usuários simultâneos sobre o mesmo equipamento

O pedido não menciona uso concorrente. Assumimos que **dois técnicos podem operar ao mesmo tempo** e que a garantia não pode depender da leitura prévia do status. A exclusão mútua é o índice único parcial `emprestimos_equipamento_aberto_uniq ON (equipamento_id) WHERE devolvido_em IS NULL AND cancelado_em IS NULL`; `fn_emprestar` captura `unique_violation` e devolve `INDISPONIVEL`. O perdedor da corrida recebe recusa, nunca um segundo empréstimo aberto.

Se o cliente esperasse operação de balcão único (um só técnico, nunca simultâneo), o impacto seria: nenhuma simplificação que valha a pena — retirar a constraint só removeria a proteção. O caminho inverso é que seria caro: se tivéssemos confiado apenas na checagem `status = 'DISPONIVEL'` antes do `INSERT`, dois cliques simultâneos criariam dois empréstimos abertos do mesmo patrimônio, e a correção exigiria migrar os dados duplicados antes de conseguir criar o índice.

### 1.9 Segunda ocorrência da mesma operação

O pedido não trata de repetição. Assumimos que **devolver duas vezes o mesmo empréstimo é erro, não operação idempotente**: a segunda chamada retorna `JA_DEVOLVIDO` com a data da primeira devolução e não altera `devolvido_em` nem o status do equipamento (`fn_devolver`). O mesmo vale para cancelamento (`JA_CANCELADO`) e para extravio sobre empréstimo encerrado (`NAO_EM_ABERTO`).

Se o cliente esperasse silêncio ("já está devolvido, tudo bem, não avise"), o impacto seria: `fn_devolver` passaria a retornar `ok: true` no caso repetido, e as telas perderiam a capacidade de distinguir um duplo clique acidental de uma devolução real — o que também invalidaria nosso critério de aceite nº 3, que verifica exatamente essa distinção.

### 1.10 Correção de erro do operador

O pedido não diz o que fazer quando o técnico registra algo errado. Assumimos **registros imutáveis com cancelamento explícito**: não há edição nem exclusão de empréstimo. `fn_cancelar` exige motivo não vazio (`MOTIVO_OBRIGATORIO`), grava `cancelado_em` e `motivo_cancelamento`, libera o equipamento e registra na tabela `auditoria`. Empréstimo já devolvido não pode ser cancelado.

Se o cliente esperasse poder simplesmente apagar o registro errado, o impacto seria: além de perder a trilha de auditoria, o índice único parcial deixaria de proteger contra duplicidade histórica, e o relatório de atrasos passaria a ser não reprodutível — dois técnicos consultando o mesmo período em momentos diferentes veriam listas diferentes sem que nada no sistema explicasse a divergência.


---

## 2. Perguntas ao cliente

### Pergunta 1 — Um equipamento é uma unidade identificada por patrimônio, ou um tipo com quantidade em estoque?

**Se a resposta for "unidade com patrimônio":** o sistema permanece como está. É a hipótese que atende diretamente a "não queremos que os equipamentos sumam", porque permite dizer qual unidade está com quem.

**Se a resposta for "tipo com quantidade":** muda a chave de negócio da tabela `equipamentos`, invalidando os registros existentes; a proteção de concorrência deixa de ser o índice único parcial e passa a ser controle de saldo com bloqueio de linha; e o sistema perde a capacidade de identificar qual unidade não voltou — o relatório de atrasos passaria a dizer "faltam 2 multímetros" sem dizer quais.

É a pergunta de maior impacto porque é a única cuja resposta obriga a refazer o esquema do banco, e não apenas a lógica.

### Pergunta 2 — Qual é o prazo de devolução, e ele é o mesmo para todo equipamento?

**Se a resposta for "prazo único de N dias":** trocamos uma constante (`PRAZO_PADRAO_DIAS`) e nada mais muda.

**Se a resposta for "depende do equipamento":** `equipamentos` ganha a coluna `prazo_dias`, obrigatória para todo item já cadastrado, e o cálculo da data prevista sai do formulário e entra em `fn_emprestar`.

**Se a resposta for "não há prazo, o aluno devolve quando terminar":** o relatório de atrasos pedido no enunciado deixa de existir, porque nada estaria atrasado. Nesse caso seria preciso perguntar ao cliente o que ele entende por "atraso" — provavelmente algo como tempo decorrido acima da média, que é um relatório completamente diferente.

O pedido exige um relatório de atrasos sem nunca definir o prazo que produz o atraso. Sem essa resposta, o entregável central não é verificável.

### Pergunta 3 — Um aluno que devolveu com atraso, ou devolveu o equipamento danificado, continua bloqueado depois de regularizar?

**Se a resposta for "não, regularizou está liberado":** o sistema permanece como está — a pendência é uma consulta sobre empréstimos vencidos em aberto.

**Se a resposta for "fica suspenso por um período":** é preciso criar uma tabela de suspensões com início e fim, porque essa informação não é derivável do estado atual dos empréstimos, e acrescentar um passo de verificação em `fn_emprestar` com código de recusa próprio.

**Se a resposta for "avaria também bloqueia":** a pendência deixa de ser derivada e passa a ser um registro com ciclo de vida próprio — alguém precisa declarar que a avaria foi resolvida, o que introduz um fluxo de quitação inexistente hoje.

A regra "aluno com pendência não pode pegar mais nada" é a única regra explícita do pedido, e a palavra central dela não foi definida.

---

## 3. Critérios de aceite

**Preparação comum:** acesse `/login`, entre com `tecnico@lab.edu.br` / `lab123456`, vá em `/admin`, digite `RESETAR` no campo de confirmação e acione a reinicialização dos dados de demonstração. Os três critérios partem desse estado.

### Critério 1 — Bloqueio por pendência

**Entrada:** em `/emprestimos/novo`, buscar o aluno pela matrícula `2021001` (Ana Souza, que tem o equipamento `EQ-001` com devolução vencida há 1 dia), selecionar o equipamento `EQ-006` e confirmar o empréstimo.

**Resultado esperado:** a operação é recusada e a tela exibe o código `PENDENCIA`. Em `/emprestimos` com o filtro "Todos", o número de linhas listadas é 5, o mesmo de antes da tentativa. O equipamento `EQ-006` continua com status Disponível em `/equipamentos`.

### Critério 2 — Bloqueio por limite

**Entrada:** em `/emprestimos/novo`, buscar o aluno pela matrícula `2021003` (Carla Dias, com 3 empréstimos em aberto e em dia), selecionar o equipamento `EQ-006` e confirmar o empréstimo.

**Resultado esperado:** a operação é recusada e a tela exibe o código `LIMITE_EXCEDIDO`. Em `/emprestimos` com o filtro "Todos", o número de linhas listadas é 5. O equipamento `EQ-006` continua Disponível.

### Critério 3 — Devolução repetida

**Entrada:** em `/devolucao`, localizar o equipamento `EQ-002` (com Bruno Lima), registrar a devolução com condição `OK`. Em seguida, ir a `/emprestimos` com o filtro "Todos", localizar a mesma linha do `EQ-002` e tentar registrar a devolução de novo.

**Resultado esperado:** a primeira operação é aceita e `EQ-002` passa a Disponível em `/equipamentos`. A segunda é recusada com o código `JA_DEVOLVIDO`, e a data e hora de devolução exibidas na linha permanecem as da primeira operação, sem alteração.

---

## Declaração de uso de IA

**Ferramenta utilizada:** `<Lovable / Claude>`

**Para quê:** geração integral do código da aplicação (esquema do banco, funções PL/pgSQL, rotas e componentes de interface) a partir de uma especificação escrita por nós, na qual já constavam as decisões da seção 1 — modelo de dados, prazo, definição de pendência, limite, códigos de erro, estratégia de concorrência e dados de demonstração. A ferramenta implementou essas decisões; não as tomou.

**O que foi verificado manualmente:**

- Leitura completa das duas migrations SQL, confirmando a existência do índice único parcial `emprestimos_equipamento_aberto_uniq` e o tratamento de `unique_violation` em `fn_emprestar` — isto é, que a exclusão mútua está na constraint e não numa leitura prévia do status.
- Conferência de que os códigos `PENDENCIA`, `LIMITE_EXCEDIDO`, `INDISPONIVEL`, `JA_DEVOLVIDO` e `PRAZO_INVALIDO` existem no código exatamente como usados nos critérios de aceite da seção 3.
- Execução dos três critérios de aceite contra a versão entregue, a partir do reset de demonstração.
- Revisão das políticas RLS e do fluxo de autenticação, que revelou o cadastro aberto descrito em 4.1 — decisão da ferramenta que não solicitamos e que está registrada aqui em vez de corrigida silenciosamente.
- Verificação de que o cálculo de atraso usa `America/Fortaleza` e não o fuso da máquina do operador.

A responsabilidade técnica pelo que é entregue é integralmente nossa.
