# DECISÕES

Sistema de empréstimo de equipamentos do laboratório
Trabalho 1 — Engenharia de Software

> **Antes de entregar:** preencha os campos marcados com `<...>` (nomes da dupla, horas, ferramenta de IA usada) e confira se as decisões abaixo continuam correspondendo ao código entregue.

Dupla: `<nome 1>` e `<nome 2>`
Repositório: `<url do repositório>`

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

### 1.11 Extravio: marcação manual, nunca automática

O pedido diz "não queremos que os equipamentos sumam", sem definir quando um item some. Assumimos que **o sistema não decide sozinho**: `fn_marcar_extravio` é acionada pelo técnico, muda o equipamento para `EXTRAVIADO` e **mantém o empréstimo em aberto**, preservando a pendência do aluno. O relatório apenas sinaliza como "possível extravio" os atrasos acima de `DIAS_POSSIVEL_EXTRAVIO = 30` dias, sem alterar nada.

Se o cliente esperasse baixa automática após N dias, o impacto seria: introduzir execução agendada no servidor — hoje o sistema não tem nenhum processo que rode sem alguém clicando —, definir com o cliente o valor de N, e decidir o efeito sobre a pendência do aluno, que hoje só termina com a devolução. Um item baixado automaticamente nunca mais seria devolvido, e o aluno ficaria pendente para sempre sem intervenção manual.

### 1.12 Quantidade zero / nenhum item disponível

O pedido não trata da indisponibilidade. Assumimos **recusa imediata, sem fila de espera nem reserva**: a tela de novo empréstimo lista apenas equipamentos com status `DISPONIVEL`, e `fn_emprestar` recusa com `INDISPONIVEL` caso o status tenha mudado entre a listagem e a confirmação.

Se o cliente esperasse fila de espera, o impacto seria: uma tabela `reservas` com ordem e validade, um novo estado do equipamento entre "devolvido" e "disponível" (reservado para o próximo da fila), e uma decisão que o pedido não permite inferir — o que acontece quando o primeiro da fila não aparece.

### 1.13 Identificação do aluno e cadastro prévio

O pedido não define como o aluno é identificado. Assumimos **matrícula como identificador único** (`alunos.matricula UNIQUE`), com **cadastro prévio obrigatório**: o sistema não cria aluno durante o empréstimo. Aluno inativo é recusado com `ALUNO_INATIVO` mas continua podendo devolver.

Se o cliente esperasse cadastro no ato, o impacto seria: a tela de novo empréstimo ganharia um formulário de criação embutido, e a matrícula deixaria de ser garantia de unicidade na prática — sob pressa no balcão, o mesmo aluno seria cadastrado com grafias diferentes, e o bloqueio por pendência passaria a ser contornável simplesmente digitando a matrícula errada.

### 1.14 Quem opera o sistema

O pedido cita o técnico como destinatário do relatório e não menciona acesso de alunos. Assumimos **um único perfil, o técnico**, operando no balcão; não há autoatendimento nem consulta pelo aluno. Toda a aplicação exige autenticação (Supabase Auth) e as políticas RLS liberam leitura e escrita para qualquer usuário autenticado.

Se o cliente esperasse que o aluno consultasse o próprio histórico, o impacto seria: introduzir papéis (`tecnico` / `aluno`) em uma tabela de perfis, vincular cada usuário autenticado a uma linha de `alunos`, e reescrever **todas** as políticas RLS, que hoje são `USING (true)` — porque com dois papéis a política deixa de ser "quem entrou pode tudo" e passa a depender de quem é o dono da linha.

### 1.15 Devolução por terceiros

O pedido não diz quem entrega o equipamento de volta. Assumimos que **qualquer pessoa pode devolver**: `fn_devolver` não exige identificação de quem traz o item, apenas o empréstimo e a condição.

Se o cliente esperasse que só o titular devolvesse, o impacto seria: acrescentar verificação de identidade na devolução e definir o procedimento para o caso em que o titular está impedido — regra que o pedido não fornece e que, na prática, transformaria a devolução em uma operação que pode ser recusada, algo que hoje o sistema garante nunca acontecer.

### 1.16 Ausência de valores monetários

O pedido não menciona dinheiro. Assumimos que **não existe multa nem cobrança** em nenhum ponto do sistema: não há coluna de valor, e o atraso produz apenas bloqueio.

Se o cliente esperasse multa por dia de atraso, o impacto seria: acrescentar valores às tabelas, criar o conceito de débito quitado ou não (que é diferente de pendência de devolução, pois sobrevive à entrega do equipamento), e passar a lidar com histórico de valores — o valor da multa muda ao longo do tempo e o sistema precisaria saber qual regra valia na data de cada empréstimo.

### 1.17 Fuso horário fixo

O pedido não trata de fuso, mas todo cálculo de atraso depende disso. Assumimos **`America/Fortaleza` fixo em código**, tanto no banco (`hoje_local()`) quanto no cliente (`TZ` em `src/lib/dominio.ts`), de modo que o resultado independa da configuração da máquina do operador.

Se o laboratório operasse em outro fuso, o impacto seria localizado — uma constante em dois lugares —, mas empréstimos registrados antes da mudança teriam sido avaliados por um limite de dia diferente, e registros próximos à meia-noite mudariam de classificação entre "em dia" e "atrasado".

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

## 4. Decisões da ferramenta de IA

### 4.1 Cadastro aberto na tela de login

**O que foi decidido:** a tela de login (`src/routes/login.tsx`, função `criarConta`) expõe um link "Primeiro acesso: criar o usuário técnico com estes dados" que chama `supabase.auth.signUp` com o e-mail e a senha digitados, seguido de login automático. Não pedimos esse recurso — a especificação previa apenas um usuário técnico de demonstração.

**Por que é plausível:** sem ele, um sistema recém-instalado não tem nenhum usuário, e ninguém consegue entrar para criar o primeiro. A ferramenta resolveu o problema do primeiro acesso da forma mais direta possível.

**Por que pode ser inadequada para este cliente:** o cadastro fica aberto permanentemente, não apenas no primeiro uso. Combinado com as políticas RLS geradas — `USING (true)` para qualquer usuário autenticado, em todas as quatro tabelas — o resultado é que **qualquer pessoa com o endereço da aplicação pode criar uma conta e obter acesso total de leitura e escrita** aos dados de alunos, equipamentos e empréstimos, inclusive apagando a base pelo reset de demonstração. Para um laboratório que guarda nomes, matrículas, e-mails e telefones de alunos, isso é exposição de dados pessoais. O correto seria criar o técnico uma única vez pelo painel do Supabase, desativar o cadastro público e condicionar as políticas a uma tabela de perfis autorizados.

### 4.2 Reset de demonstração acessível a qualquer usuário autenticado

**O que foi decidido:** `fn_reset_demo` (primeira migration) apaga `auditoria`, `emprestimos`, `equipamentos` e `alunos` e recria a base de demonstração. A ferramenta concedeu `EXECUTE` dessa função ao papel `authenticated`, exatamente como fez com as funções de operação cotidiana. A proteção existente é apenas na interface: `src/routes/admin.tsx` exige digitar `RESETAR` antes de habilitar o botão.

**Por que é plausível:** pedimos o botão de reset e não dissemos quem poderia usá-lo; havendo um único perfil, tratá-lo como qualquer outra operação é coerente.

**Por que pode ser inadequada:** a confirmação por digitação é apenas visual — a função é uma RPC que qualquer usuário autenticado pode chamar diretamente com a chave publishable, sem passar pela tela. Um recurso destrutivo e irreversível ficou no mesmo nível de permissão do registro de um empréstimo. Em uso real, o reset não deveria existir em produção, ou deveria exigir o papel de serviço.

### 4.3 Regras de negócio duplicadas entre banco e interface

**O que foi decidido:** os valores `PRAZO_PADRAO_DIAS = 7`, `LIMITE_EMPRESTIMOS = 3` e a função `diasAtraso` foram declarados em `src/lib/dominio.ts`, replicando regras que já existem dentro de `fn_emprestar` e `aluno_pendencia` no banco. A ferramenta implementou a mesma regra duas vezes, em duas linguagens.

**Por que é plausível:** a interface precisa sugerir a data prevista, colorir os atrasos e exibir os parâmetros vigentes na tela de administração sem uma ida ao servidor a cada tecla.

**Por que pode ser inadequada:** as duas cópias podem divergir silenciosamente. Se o cliente pedir prazo de 10 dias e a alteração for feita apenas em `dominio.ts`, o formulário passa a sugerir 10 dias e o banco continua validando a faixa antiga — o técnico vê a data preenchida pelo próprio sistema ser recusada por `PRAZO_INVALIDO`, sem explicação. O banco deveria expor esses parâmetros e a interface lê-los, em vez de reafirmá-los.

### 4.4 Limites e filtros padrão não solicitados

**O que foi decidido:** a busca de alunos em `src/routes/emprestimos.novo.tsx` só dispara a partir de 2 caracteres e trunca em 20 resultados (`.limit(20)`); a listagem de `/emprestimos` abre com o filtro "Em aberto" e não "Todos"; o relatório de atrasos ordena por dias de atraso decrescente e exporta CSV separado por ponto e vírgula com BOM UTF-8 (`src/routes/atrasos.tsx`).

**Por que é plausível:** todas são escolhas razoáveis de usabilidade — o ponto e vírgula com BOM, em particular, é o que faz o CSV abrir corretamente no Excel em português.

**Por que pode ser inadequada:** o truncamento em 20 é silencioso. Numa turma com muitos sobrenomes repetidos, o técnico busca "Silva", não encontra o aluno certo, e nada na tela indica que a lista foi cortada. O aluno some da busca sem que ninguém perceba, e a decisão de exibir apenas os 20 primeiros por ordem alfabética nunca foi tomada por nós nem pelo cliente.

---

## Registro de tempo

Horas escrevendo ou gerando código: `<preencher>`
Horas decidindo o que o sistema deveria fazer: `<preencher>`

---

## Declaração de uso de IA

**Ferramenta utilizada:** `<Lovable / outra — informe também os assistentes usados na redação deste documento>`

**Para quê:** geração integral do código da aplicação (esquema do banco, funções PL/pgSQL, rotas e componentes de interface) a partir de uma especificação escrita por nós, na qual já constavam as decisões da seção 1 — modelo de dados, prazo, definição de pendência, limite, códigos de erro, estratégia de concorrência e dados de demonstração. A ferramenta implementou essas decisões; não as tomou.

**O que foi verificado manualmente:**

- Leitura completa das duas migrations SQL, confirmando a existência do índice único parcial `emprestimos_equipamento_aberto_uniq` e o tratamento de `unique_violation` em `fn_emprestar` — isto é, que a exclusão mútua está na constraint e não numa leitura prévia do status.
- Conferência de que os códigos `PENDENCIA`, `LIMITE_EXCEDIDO`, `INDISPONIVEL`, `JA_DEVOLVIDO` e `PRAZO_INVALIDO` existem no código exatamente como usados nos critérios de aceite da seção 3.
- Execução dos três critérios de aceite contra a versão entregue, a partir do reset de demonstração.
- Revisão das políticas RLS e do fluxo de autenticação, que revelou o cadastro aberto descrito em 4.1 — decisão da ferramenta que não solicitamos e que está registrada aqui em vez de corrigida silenciosamente.
- Verificação de que o cálculo de atraso usa `America/Fortaleza` e não o fuso da máquina do operador.

A responsabilidade técnica pelo que é entregue é integralmente nossa.
