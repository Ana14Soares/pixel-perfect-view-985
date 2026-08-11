import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  chamarRpc,
  diasAtraso,
  formatarData,
  formatarDataHora,
  hojeLocal,
  type ResultadoOperacao,
} from "@/lib/dominio";

export const Route = createFileRoute("/devolucao")({
  head: () => ({
    meta: [
      { title: "Registrar devolução | Laboratório" },
      {
        name: "description",
        content:
          "Registrar devolução de equipamento por patrimônio ou aluno, com condição OK ou avariado.",
      },
      { property: "og:title", content: "Registrar devolução de equipamento" },
      {
        property: "og:description",
        content: "Devolução no balcão do laboratório com condição e observação.",
      },
    ],
  }),
  component: Devolucao,
});

function Devolucao() {
  const hoje = hojeLocal();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [condicao, setCondicao] = useState<"OK" | "AVARIADO">("OK");
  const [obs, setObs] = useState("");
  const [res, setRes] = useState<ResultadoOperacao | null>(null);

  const abertos = useQuery({
    queryKey: ["abertos-devolucao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emprestimos")
        .select(
          "id,previsto_para,retirado_em,alunos(nome,matricula),equipamentos(id,patrimonio,nome,status)",
        )
        .is("devolvido_em", null)
        .is("cancelado_em", null)
        .order("previsto_para");
      if (error) throw error;
      return data ?? [];
    },
  });

  const t = busca.trim().toLowerCase();
  const lista = (abertos.data ?? []).filter((e) =>
    !t
      ? true
      : [e.equipamentos?.patrimonio, e.equipamentos?.nome, e.alunos?.nome, e.alunos?.matricula]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(t)),
  );

  const registrar = useMutation({
    mutationFn: async () =>
      chamarRpc("fn_devolver", {
        p_emprestimo_id: selecionado,
        p_condicao: condicao,
        p_observacao: obs.trim() || null,
      }),
    onSuccess: (r) => {
      setRes(r);
      qc.invalidateQueries();
      if (r.ok) {
        setSelecionado(null);
        setObs("");
        setCondicao("OK");
      }
    },
  });

  const item = (abertos.data ?? []).find((e) => e.id === selecionado);

  return (
    <AppShell
      titulo="Registrar devolução"
      descricao="Qualquer pessoa pode devolver o equipamento; não é exigida identificação de quem entrega."
      acoes={
        <Link to="/" className={botaoSecundarioClasse}>
          Voltar ao painel
        </Link>
      }
    >
      <div className="space-y-4">
        {res ? <ResultadoAlerta res={res} /> : null}

        <section className="rounded border border-border-strong bg-card p-4">
          <Campo label="Buscar por patrimônio ou aluno">
            <input
              className={inputClasse}
              autoFocus
              value={busca}
              placeholder="ex.: EQ-002 ou Bruno"
              onChange={(e) => setBusca(e.target.value)}
            />
          </Campo>
          <ul className="mt-2 max-h-72 divide-y divide-border overflow-y-auto rounded border border-border">
            {lista.map((e) => {
              const atraso = diasAtraso(e.previsto_para, hoje);
              return (
                <li key={e.id}>
                  <button
                    onClick={() => {
                      setSelecionado(e.id);
                      setRes(null);
                    }}
                    className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left text-sm hover:bg-secondary ${
                      selecionado === e.id ? "bg-accent font-semibold" : ""
                    }`}
                  >
                    <span className="font-mono">{e.equipamentos?.patrimonio}</span>
                    <span>{e.equipamentos?.nome}</span>
                    <span className="text-muted-foreground">
                      {e.alunos?.nome} ({e.alunos?.matricula})
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        previsto {formatarData(e.previsto_para)}
                      </span>
                      {atraso > 0 ? <Selo tom="erro">{atraso}d atraso</Selo> : null}
                      {e.equipamentos?.status === "EXTRAVIADO" ? (
                        <Selo tom="erro">Extraviado</Selo>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
            {lista.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Nenhum empréstimo em aberto para esta busca.
              </li>
            ) : null}
          </ul>
        </section>

        {item ? (
          <section className="rounded border-2 border-border-strong bg-surface p-4">
            <p className="mb-3 text-sm">
              <span className="font-mono">{item.equipamentos?.patrimonio}</span> —{" "}
              {item.equipamentos?.nome} · retirado em {formatarDataHora(item.retirado_em)} por{" "}
              {item.alunos?.nome}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Condição na devolução">
                <div className="flex gap-2">
                  {(["OK", "AVARIADO"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCondicao(c)}
                      className={`flex-1 rounded border-2 px-3 py-2 text-sm font-semibold ${
                        condicao === c
                          ? c === "OK"
                            ? "border-success bg-success/10 text-success"
                            : "border-warning bg-warning/20 text-warning-foreground"
                          : "border-border-strong bg-card text-muted-foreground"
                      }`}
                    >
                      {c === "OK" ? "OK → Disponível" : "Avariado → Manutenção"}
                    </button>
                  ))}
                </div>
              </Campo>
              <Campo label="Observação (opcional)">
                <input
                  className={inputClasse}
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                />
              </Campo>
            </div>
            <button
              className={botaoClasse + " mt-4 px-6 py-3 text-base"}
              disabled={registrar.isPending}
              onClick={() => registrar.mutate()}
            >
              Confirmar devolução
            </button>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
