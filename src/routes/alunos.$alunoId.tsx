import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Selo, Tabela, botaoSecundarioClasse, tdClasse, thClasse } from "@/components/ui-lab";
import { diasAtraso, formatarData, formatarDataHora, hojeLocal } from "@/lib/dominio";

export const Route = createFileRoute("/alunos/$alunoId")({
  head: () => ({
    meta: [
      { title: "Histórico do aluno | Laboratório" },
      {
        name: "description",
        content: "Histórico completo de empréstimos, devoluções e cancelamentos de um aluno.",
      },
      { property: "og:title", content: "Histórico do aluno" },
      { property: "og:description", content: "Empréstimos e devoluções registrados para o aluno." },
    ],
  }),
  component: HistoricoAluno,
});

function HistoricoAluno() {
  const { alunoId } = useParams({ from: "/alunos/$alunoId" });
  const hoje = hojeLocal();

  const dados = useQuery({
    queryKey: ["aluno", alunoId],
    queryFn: async () => {
      const [{ data: aluno, error: e1 }, { data: emps, error: e2 }] = await Promise.all([
        supabase.from("alunos").select("*").eq("id", alunoId).maybeSingle(),
        supabase
          .from("emprestimos")
          .select(
            "id,retirado_em,previsto_para,devolvido_em,condicao_devolucao,observacao_devolucao,cancelado_em,motivo_cancelamento,equipamentos(patrimonio,nome)",
          )
          .eq("aluno_id", alunoId)
          .order("retirado_em", { ascending: false }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { aluno, emps: emps ?? [] };
    },
  });

  const aluno = dados.data?.aluno;

  return (
    <AppShell
      titulo={aluno ? `${aluno.nome}` : "Aluno"}
      descricao={aluno ? `Matrícula ${aluno.matricula} · ${aluno.email ?? "sem e-mail"}` : ""}
      acoes={
        <Link to="/alunos" className={botaoSecundarioClasse}>
          Voltar
        </Link>
      }
    >
      <Tabela>
        <thead>
          <tr>
            <th className={thClasse}>Equipamento</th>
            <th className={thClasse}>Retirada</th>
            <th className={thClasse}>Previsto</th>
            <th className={thClasse}>Devolução</th>
            <th className={thClasse}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {(dados.data?.emps ?? []).map((e) => {
            const aberto = !e.devolvido_em && !e.cancelado_em;
            const atraso = aberto ? diasAtraso(e.previsto_para, hoje) : 0;
            return (
              <tr key={e.id}>
                <td className={tdClasse}>
                  {e.equipamentos?.nome}
                  <span className="block font-mono text-xs text-muted-foreground">
                    {e.equipamentos?.patrimonio}
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
                  ) : atraso > 0 ? (
                    <Selo tom="erro">{atraso}d atraso</Selo>
                  ) : (
                    <Selo tom="ok">Em aberto, em dia</Selo>
                  )}
                </td>
              </tr>
            );
          })}
          {dados.data && dados.data.emps.length === 0 ? (
            <tr>
              <td className={tdClasse} colSpan={5}>
                Nenhum empréstimo registrado.
              </td>
            </tr>
          ) : null}
        </tbody>
      </Tabela>
    </AppShell>
  );
}
