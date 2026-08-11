import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  ResultadoAlerta,
  Selo,
  Tabela,
  botaoPerigoClasse,
  botaoSecundarioClasse,
  inputClasse,
  tdClasse,
  thClasse,
} from "@/components/ui-lab";
import {
  chamarRpc,
  diasAtraso,
  formatarData,
  formatarDataHora,
  hojeLocal,
  type ResultadoOperacao,
} from "@/lib/dominio";

export const Route = createFileRoute("/emprestimos/")({
  head: () => ({
    meta: [
      { title: "Empréstimos | Laboratório" },
      {
        name: "description",
        content:
          "Lista de empréstimos de equipamentos com filtros de em aberto, atrasados e todos, além de devolução, cancelamento e extravio.",
      },
      { property: "og:title", content: "Empréstimos de equipamentos" },
      {
        property: "og:description",
        content: "O que está emprestado, para quem e desde quando.",
      },
    ],
  }),
  component: Emprestimos,
});

type Filtro = "ABERTO" | "ATRASADO" | "TODOS";

function Emprestimos() {
  const hoje = hojeLocal();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("ABERTO");
  const [busca, setBusca] = useState("");
  const [res, setRes] = useState<ResultadoOperacao | null>(null);

  const lista = useQuery({
    queryKey: ["emprestimos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emprestimos")
        .select(
          "id,retirado_em,previsto_para,devolvido_em,condicao_devolucao,observacao_devolucao,cancelado_em,motivo_cancelamento,alunos(nome,matricula),equipamentos(patrimonio,nome,status)",
        )
        .order("retirado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const acao = useMutation({
    mutationFn: async (v: { fn: "fn_devolver" | "fn_cancelar" | "fn_marcar_extravio"; args: Record<string, unknown> }) =>
      chamarRpc(v.fn, v.args),
    onSuccess: (r) => {
      setRes(r);
      qc.invalidateQueries();
    },
  });

  const t = busca.trim().toLowerCase();
  const filtrados = (lista.data ?? []).filter((e) => {
    const aberto = !e.devolvido_em && !e.cancelado_em;
    if (filtro === "ABERTO" && !aberto) return false;
    if (filtro === "ATRASADO" && !(aberto && e.previsto_para < hoje)) return false;
    if (!t) return true;
    return [e.alunos?.nome, e.alunos?.matricula, e.equipamentos?.patrimonio, e.equipamentos?.nome]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(t));
  });

  return (
    <AppShell
      titulo="Empréstimos"
      descricao="Registros são imutáveis: corrija erros por cancelamento, nunca por edição."
      acoes={
        <Link to="/emprestimos/novo" className={botaoSecundarioClasse}>
          Novo empréstimo
        </Link>
      }
    >
      <div className="space-y-3">
        {res ? <ResultadoAlerta res={res} /> : null}
        <div className="flex flex-wrap items-center gap-2">
          {(["ABERTO", "ATRASADO", "TODOS"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded border px-3 py-1.5 text-sm font-medium ${
                filtro === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border-strong bg-card hover:bg-secondary"
              }`}
            >
              {f === "ABERTO" ? "Em aberto" : f === "ATRASADO" ? "Atrasados" : "Todos"}
            </button>
          ))}
          <input
            className={inputClasse + " ml-auto max-w-xs"}
            placeholder="Buscar aluno ou equipamento"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <Tabela>
          <thead>
            <tr>
              <th className={thClasse}>Aluno</th>
              <th className={thClasse}>Equipamento</th>
              <th className={thClasse}>Retirada</th>
              <th className={thClasse}>Previsto</th>
              <th className={thClasse}>Situação</th>
              <th className={thClasse}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((e) => {
              const aberto = !e.devolvido_em && !e.cancelado_em;
              const atraso = aberto ? diasAtraso(e.previsto_para, hoje) : 0;
              return (
                <tr key={e.id}>
                  <td className={tdClasse}>
                    {e.alunos?.nome}
                    <span className="block font-mono text-xs text-muted-foreground">
                      {e.alunos?.matricula}
                    </span>
                  </td>
                  <td className={tdClasse}>
                    {e.equipamentos?.nome}
                    <span className="block font-mono text-xs text-muted-foreground">
                      {e.equipamentos?.patrimonio}
                    </span>
                  </td>
                  <td className={tdClasse + " whitespace-nowrap"}>
                    {formatarDataHora(e.retirado_em)}
                  </td>
                  <td className={tdClasse + " whitespace-nowrap"}>
                    {formatarData(e.previsto_para)}
                  </td>
                  <td className={tdClasse}>
                    {e.cancelado_em ? (
                      <span title={e.motivo_cancelamento ?? ""}>
                        <Selo>Cancelado</Selo>
                      </span>
                    ) : e.devolvido_em ? (
                      <Selo tom={e.condicao_devolucao === "AVARIADO" ? "alerta" : "ok"}>
                        Devolvido {e.condicao_devolucao}
                      </Selo>
                    ) : atraso > 0 ? (
                      <Selo tom="erro">{atraso}d atraso</Selo>
                    ) : (
                      <Selo tom="ok">Em dia</Selo>
                    )}
                    {e.equipamentos?.status === "EXTRAVIADO" && aberto ? (
                      <span className="ml-1">
                        <Selo tom="erro">Extraviado</Selo>
                      </span>
                    ) : null}
                  </td>
                  <td className={tdClasse}>
                    {aberto ? (
                      <div className="flex flex-wrap gap-1">
                        <button
                          className={botaoPerigoClasse + " border-success text-success"}
                          disabled={acao.isPending}
                          onClick={() =>
                            acao.mutate({
                              fn: "fn_devolver",
                              args: {
                                p_emprestimo_id: e.id,
                                p_condicao: "OK",
                                p_observacao: null,
                              },
                            })
                          }
                        >
                          Devolver OK
                        </button>
                        <button
                          className={botaoPerigoClasse}
                          disabled={acao.isPending}
                          onClick={() => {
                            const motivo = window.prompt("Motivo do cancelamento (obrigatório):");
                            if (motivo === null) return;
                            acao.mutate({
                              fn: "fn_cancelar",
                              args: { p_emprestimo_id: e.id, p_motivo: motivo },
                            });
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          className={botaoPerigoClasse}
                          disabled={acao.isPending}
                          onClick={() => {
                            if (!window.confirm("Marcar este equipamento como EXTRAVIADO?")) return;
                            acao.mutate({
                              fn: "fn_marcar_extravio",
                              args: { p_emprestimo_id: e.id },
                            });
                          }}
                        >
                          Extravio
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {e.cancelado_em
                          ? `Cancelado: ${e.motivo_cancelamento}`
                          : `Devolvido em ${formatarDataHora(e.devolvido_em)}`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 ? (
              <tr>
                <td className={tdClasse} colSpan={6}>
                  Nenhum registro para este filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </Tabela>
      </div>
    </AppShell>
  );
}
