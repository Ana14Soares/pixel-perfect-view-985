import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  Selo,
  StatusEquipamento,
  Tabela,
  botaoSecundarioClasse,
  tdClasse,
  thClasse,
} from "@/components/ui-lab";
import { formatarData, formatarDataHora } from "@/lib/dominio";

export const Route = createFileRoute("/equipamentos/$equipamentoId")({
  head: () => ({
    meta: [
      { title: "Histórico do equipamento | Laboratório" },
      {
        name: "description",
        content: "Histórico de empréstimos, devoluções e ocorrências de um patrimônio do laboratório.",
      },
      { property: "og:title", content: "Histórico do equipamento" },
      { property: "og:description", content: "Todos os empréstimos registrados para este patrimônio." },
    ],
  }),
  component: HistoricoEquipamento,
});

function HistoricoEquipamento() {
  const { equipamentoId } = useParams({ from: "/equipamentos/$equipamentoId" });

  const dados = useQuery({
    queryKey: ["equipamento", equipamentoId],
    queryFn: async () => {
      const [{ data: eq, error: e1 }, { data: emps, error: e2 }] = await Promise.all([
        supabase.from("equipamentos").select("*").eq("id", equipamentoId).maybeSingle(),
        supabase
          .from("emprestimos")
          .select(
            "id,retirado_em,previsto_para,devolvido_em,condicao_devolucao,observacao_devolucao,cancelado_em,motivo_cancelamento,alunos(nome,matricula)",
          )
          .eq("equipamento_id", equipamentoId)
          .order("retirado_em", { ascending: false }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { eq, emps: emps ?? [] };
    },
  });

  const eq = dados.data?.eq;

  return (
    <AppShell
      titulo={eq ? `${eq.patrimonio} — ${eq.nome}` : "Equipamento"}
      descricao={eq ? `${eq.categoria}${eq.observacoes ? " · " + eq.observacoes : ""}` : ""}
      acoes={
        <>
          {eq ? <StatusEquipamento status={eq.status} /> : null}
          <Link to="/equipamentos" className={botaoSecundarioClasse}>
            Voltar
          </Link>
        </>
      }
    >
      <Tabela>
        <thead>
          <tr>
            <th className={thClasse}>Aluno</th>
            <th className={thClasse}>Retirada</th>
            <th className={thClasse}>Previsto</th>
            <th className={thClasse}>Devolução</th>
            <th className={thClasse}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {(dados.data?.emps ?? []).map((e) => (
            <tr key={e.id}>
              <td className={tdClasse}>
                {e.alunos?.nome}
                <span className="block font-mono text-xs text-muted-foreground">
                  {e.alunos?.matricula}
                </span>
              </td>
              <td className={tdClasse}>{formatarDataHora(e.retirado_em)}</td>
              <td className={tdClasse}>{formatarData(e.previsto_para)}</td>
              <td className={tdClasse}>
                {formatarDataHora(e.devolvido_em)}
                {e.observacao_devolucao ? (
                  <span className="block text-xs text-muted-foreground">
                    {e.observacao_devolucao}
                  </span>
                ) : null}
              </td>
              <td className={tdClasse}>
                {e.cancelado_em ? (
                  <Selo>Cancelado: {e.motivo_cancelamento}</Selo>
                ) : e.devolvido_em ? (
                  <Selo tom={e.condicao_devolucao === "AVARIADO" ? "alerta" : "ok"}>
                    Devolvido {e.condicao_devolucao}
                  </Selo>
                ) : (
                  <Selo tom="alerta">Em aberto</Selo>
                )}
              </td>
            </tr>
          ))}
          {dados.data && dados.data.emps.length === 0 ? (
            <tr>
              <td className={tdClasse} colSpan={5}>
                Nenhum histórico. Este equipamento pode ser excluído com segurança.
              </td>
            </tr>
          ) : null}
        </tbody>
      </Tabela>
    </AppShell>
  );
}
