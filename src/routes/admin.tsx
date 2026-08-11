import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  ResultadoAlerta,
  Tabela,
  botaoPerigoClasse,
  inputClasse,
  tdClasse,
  thClasse,
} from "@/components/ui-lab";
import {
  DIAS_POSSIVEL_EXTRAVIO,
  LIMITE_EMPRESTIMOS,
  PRAZO_PADRAO_DIAS,
  TZ,
  chamarRpc,
  formatarDataHora,
  type ResultadoOperacao,
} from "@/lib/dominio";
import { RotateCcw } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração | Laboratório" },
      {
        name: "description",
        content:
          "Parâmetros do sistema de empréstimos, trilha de auditoria e reinicialização dos dados de demonstração.",
      },
      { property: "og:title", content: "Administração do sistema de empréstimos" },
      { property: "og:description", content: "Regras vigentes, auditoria e reset de demonstração." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const qc = useQueryClient();
  const [res, setRes] = useState<ResultadoOperacao | null>(null);
  const [confirmacao, setConfirmacao] = useState("");

  const auditoria = useQuery({
    queryKey: ["auditoria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria")
        .select("id,criado_em,acao,entidade,entidade_id,detalhes")
        .order("criado_em", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const reset = useMutation({
    mutationFn: async () => chamarRpc("fn_reset_demo", {}),
    onSuccess: (r) => {
      setRes(r);
      setConfirmacao("");
      qc.invalidateQueries();
    },
  });

  return (
    <AppShell titulo="Administração" descricao="Parâmetros vigentes, auditoria e dados de demonstração.">
      <div className="space-y-6">
        {res ? <ResultadoAlerta res={res} /> : null}

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["Prazo padrão", `${PRAZO_PADRAO_DIAS} dias`],
            ["Limite simultâneo", `${LIMITE_EMPRESTIMOS} por aluno`],
            ["Possível extravio", `> ${DIAS_POSSIVEL_EXTRAVIO} dias de atraso`],
            ["Fuso horário", TZ],
          ].map(([k, v]) => (
            <div key={k} className="rounded border border-border-strong bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</p>
              <p className="mt-1 text-lg font-semibold">{v}</p>
            </div>
          ))}
        </section>

        <section className="rounded border-2 border-destructive bg-destructive/5 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-destructive">
            Resetar dados de demonstração
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Apaga todos os empréstimos, alunos, equipamentos e auditoria e recria a base de
            demonstração. Ação irreversível. Digite <span className="codigo-erro">RESETAR</span> para
            liberar o botão.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className={inputClasse + " max-w-[180px]"}
              value={confirmacao}
              placeholder="RESETAR"
              onChange={(e) => setConfirmacao(e.target.value)}
            />
            <button
              className={botaoPerigoClasse}
              disabled={confirmacao.trim().toUpperCase() !== "RESETAR" || reset.isPending}
              onClick={() => reset.mutate()}
            >
              <RotateCcw className="size-3.5" /> Resetar dados de demonstração
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Auditoria (últimos 100 eventos)
          </h2>
          <Tabela>
            <thead>
              <tr>
                <th className={thClasse}>Quando</th>
                <th className={thClasse}>Ação</th>
                <th className={thClasse}>Entidade</th>
                <th className={thClasse}>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {(auditoria.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td className={tdClasse}>{formatarDataHora(a.criado_em)}</td>
                  <td className={tdClasse + " font-mono text-xs"}>{a.acao}</td>
                  <td className={tdClasse + " font-mono text-xs"}>
                    {a.entidade}
                    <span className="block text-muted-foreground">{a.entidade_id}</span>
                  </td>
                  <td className={tdClasse + " max-w-md truncate text-xs text-muted-foreground"}>
                    {JSON.stringify(a.detalhes)}
                  </td>
                </tr>
              ))}
              {auditoria.data && auditoria.data.length === 0 ? (
                <tr>
                  <td className={tdClasse} colSpan={4}>
                    Nenhum evento registrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Tabela>
        </section>
      </div>
    </AppShell>
  );
}
