import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  Campo,
  ResultadoAlerta,
  Selo,
  botaoClasse,
  botaoSecundarioClasse,
  inputClasse,
} from "@/components/ui-lab";
import {
  PRAZO_PADRAO_DIAS,
  chamarRpc,
  diasAtraso,
  formatarData,
  hojeLocal,
  somarDias,
  type ResultadoOperacao,
} from "@/lib/dominio";

export const Route = createFileRoute("/emprestimos/novo")({
  head: () => ({
    meta: [
      { title: "Novo empréstimo | Laboratório" },
      {
        name: "description",
        content:
          "Registrar empréstimo de equipamento: busca de aluno por matrícula, alerta de pendência e prazo de 7 dias.",
      },
      { property: "og:title", content: "Novo empréstimo de equipamento" },
      {
        property: "og:description",
        content: "Registro de empréstimo no balcão do laboratório em poucos cliques.",
      },
    ],
  }),
  component: NovoEmprestimo,
});

type Aluno = {
  id: string;
  matricula: string;
  nome: string;
  ativo: boolean;
};

function NovoEmprestimo() {
  const hoje = hojeLocal();
  const qc = useQueryClient();
  const [buscaAluno, setBuscaAluno] = useState("");
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [buscaEq, setBuscaEq] = useState("");
  const [equipamentoId, setEquipamentoId] = useState<string | null>(null);
  const [previsto, setPrevisto] = useState(somarDias(hoje, PRAZO_PADRAO_DIAS));
  const [res, setRes] = useState<ResultadoOperacao | null>(null);

  const alunos = useQuery({
    queryKey: ["alunos-busca", buscaAluno],
    enabled: buscaAluno.trim().length >= 2,
    queryFn: async () => {
      const t = buscaAluno.trim();
      const { data, error } = await supabase
        .from("alunos")
        .select("id,matricula,nome,ativo")
        .or(`matricula.ilike.%${t}%,nome.ilike.%${t}%`)
        .order("nome")
        .limit(20);
      if (error) throw error;
      return data as Aluno[];
    },
  });

  const situacao = useQuery({
    queryKey: ["situacao-aluno", aluno?.id],
    enabled: !!aluno,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emprestimos")
        .select("id,previsto_para,equipamentos(patrimonio,nome)")
        .eq("aluno_id", aluno!.id)
        .is("devolvido_em", null)
        .is("cancelado_em", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const equipamentos = useQuery({
    queryKey: ["equipamentos-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos")
        .select("id,patrimonio,nome,categoria")
        .eq("status", "DISPONIVEL")
        .order("patrimonio");
      if (error) throw error;
      return data ?? [];
    },
  });

  const listaEq = useMemo(() => {
    const t = buscaEq.trim().toLowerCase();
    const base = equipamentos.data ?? [];
    if (!t) return base;
    return base.filter(
      (e) => e.patrimonio.toLowerCase().includes(t) || e.nome.toLowerCase().includes(t),
    );
  }, [buscaEq, equipamentos.data]);

  const vencidos = (situacao.data ?? []).filter((e) => e.previsto_para < hoje);
  const abertos = situacao.data?.length ?? 0;
  const dias = previsto ? Math.round((Date.parse(previsto) - Date.parse(hoje)) / 86400000) : 0;

  const registrar = useMutation({
    mutationFn: async () =>
      chamarRpc("fn_emprestar", {
        p_aluno_id: aluno?.id,
        p_equipamento_id: equipamentoId,
        p_previsto_para: previsto,
      }),
    onSuccess: (r) => {
      setRes(r);
      qc.invalidateQueries();
      if (r.ok) {
        setAluno(null);
        setBuscaAluno("");
        setEquipamentoId(null);
        setBuscaEq("");
        setPrevisto(somarDias(hoje, PRAZO_PADRAO_DIAS));
      }
    },
  });

  const equipamentoSelecionado = listaEq.find((e) => e.id === equipamentoId);

  return (
    <AppShell
      titulo="Novo empréstimo"
      descricao="1) aluno · 2) equipamento · 3) prazo · 4) confirmar"
      acoes={
        <Link to="/" className={botaoSecundarioClasse}>
          Voltar ao painel
        </Link>
      }
    >
      <div className="space-y-4">
        {res ? <ResultadoAlerta res={res} /> : null}

        <section className="rounded border border-border-strong bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            1. Aluno
          </h2>
          <Campo label="Buscar por matrícula ou nome">
            <input
              className={inputClasse}
              value={buscaAluno}
              autoFocus
              placeholder="ex.: 2021001 ou Ana"
              onChange={(e) => {
                setBuscaAluno(e.target.value);
                setAluno(null);
                setRes(null);
              }}
            />
          </Campo>

          {!aluno && buscaAluno.trim().length >= 2 ? (
            <ul className="mt-2 divide-y divide-border rounded border border-border">
              {(alunos.data ?? []).map((a) => (
                <li key={a.id}>
                  <button
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                    onClick={() => setAluno(a)}
                  >
                    <span>
                      <span className="font-mono">{a.matricula}</span> — {a.nome}
                    </span>
                    {!a.ativo ? <Selo tom="erro">Inativo</Selo> : null}
                  </button>
                </li>
              ))}
              {alunos.data && alunos.data.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  Nenhum aluno encontrado. O cadastro prévio é obrigatório —{" "}
                  <Link to="/alunos" className="underline">
                    cadastrar aluno
                  </Link>
                  .
                </li>
              ) : null}
            </ul>
          ) : null}

          {aluno ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm">
                <span className="font-mono">{aluno.matricula}</span>
                <span className="font-semibold">{aluno.nome}</span>
                {!aluno.ativo ? <Selo tom="erro">Inativo</Selo> : null}
                <Selo>{abertos} em aberto</Selo>
                <button
                  className="ml-auto text-xs underline"
                  onClick={() => {
                    setAluno(null);
                    setRes(null);
                  }}
                >
                  trocar
                </button>
              </div>

              {!aluno.ativo ? (
                <ResultadoAlerta
                  res={{
                    ok: false,
                    codigo: "ALUNO_INATIVO",
                    mensagem: `${aluno.nome} está inativo e não pode receber novos empréstimos.`,
                  }}
                />
              ) : null}

              {vencidos.length > 0 ? (
                <ResultadoAlerta
                  res={{
                    ok: false,
                    codigo: "PENDENCIA",
                    mensagem: `${aluno.nome} possui ${vencidos.length} devolução(ões) vencida(s) há ${Math.max(
                      ...vencidos.map((v) => diasAtraso(v.previsto_para, hoje)),
                    )} dia(s): ${vencidos.map((v) => v.equipamentos?.patrimonio).join(", ")}`,
                  }}
                />
              ) : null}

              {vencidos.length === 0 && abertos >= 3 ? (
                <ResultadoAlerta
                  res={{
                    ok: false,
                    codigo: "LIMITE_EXCEDIDO",
                    mensagem: `${aluno.nome} já possui 3 empréstimos em aberto (máximo 3).`,
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded border border-border-strong bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            2. Equipamento disponível
          </h2>
          <Campo label="Buscar por patrimônio ou nome">
            <input
              className={inputClasse}
              value={buscaEq}
              placeholder="ex.: EQ-006 ou Multímetro"
              onChange={(e) => setBuscaEq(e.target.value)}
            />
          </Campo>
          <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded border border-border">
            {listaEq.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setEquipamentoId(e.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary ${
                    equipamentoId === e.id ? "bg-accent font-semibold" : ""
                  }`}
                >
                  <span className="font-mono">{e.patrimonio}</span>
                  <span>{e.nome}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{e.categoria}</span>
                </button>
              </li>
            ))}
            {listaEq.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Nenhum equipamento disponível para esta busca.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="rounded border border-border-strong bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            3. Prazo de devolução
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-56">
              <Campo
                label="Devolver até"
                dica={`Padrão 7 dias corridos · ${dias} dia(s) a partir de hoje`}
              >
                <input
                  type="date"
                  className={inputClasse}
                  value={previsto}
                  min={somarDias(hoje, 1)}
                  max={somarDias(hoje, 30)}
                  onChange={(e) => setPrevisto(e.target.value)}
                />
              </Campo>
            </div>
            {dias < 1 || dias > 30 ? (
              <p className="codigo-erro text-sm text-destructive">
                PRAZO_INVALIDO — use de 1 a 30 dias
              </p>
            ) : null}
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3 rounded border-2 border-border-strong bg-surface p-4">
          <div className="text-sm">
            <p>
              <span className="text-muted-foreground">Aluno: </span>
              {aluno ? `${aluno.matricula} — ${aluno.nome}` : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Equipamento: </span>
              {equipamentoSelecionado
                ? `${equipamentoSelecionado.patrimonio} — ${equipamentoSelecionado.nome}`
                : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Devolver até: </span>
              {formatarData(previsto)}
            </p>
          </div>
          <button
            className={botaoClasse + " ml-auto px-6 py-3 text-base"}
            disabled={!aluno || !equipamentoId || registrar.isPending}
            onClick={() => registrar.mutate()}
          >
            Confirmar empréstimo
          </button>
        </section>
      </div>
    </AppShell>
  );
}
