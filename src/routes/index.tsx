import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { hojeLocal, formatarData, diasAtraso } from "@/lib/dominio";
import { Selo, Tabela, thClasse, tdClasse } from "@/components/ui-lab";
import { ArrowRight, PackageCheck, PackagePlus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel | Empréstimo de Equipamentos do Laboratório" },
      {
        name: "description",
        content:
          "Painel do balcão: equipamentos emprestados, atrasos em aberto, alunos pendentes e itens disponíveis.",
      },
      { property: "og:title", content: "Painel de empréstimos do laboratório" },
      {
        property: "og:description",
        content: "Controle de empréstimo de equipamentos de laboratório com poucos cliques.",
      },
    ],
  }),
  component: Painel,
});

export function usePainel() {
  return useQuery({
    queryKey: ["painel"],
    queryFn: async () => {
      const [{ data: equipamentos, error: e1 }, { data: abertos, error: e2 }] = await Promise.all([
        supabase.from("equipamentos").select("id,status"),
        supabase
          .from("emprestimos")
          .select("id,previsto_para,aluno_id,alunos(nome,matricula),equipamentos(patrimonio,nome)")
          .is("devolvido_em", null)
          .is("cancelado_em", null)
          .order("previsto_para", { ascending: true }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { equipamentos: equipamentos ?? [], abertos: abertos ?? [] };
    },
  });
}

function Cartao({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: string }) {
  return (
    <div className="rounded border border-border-strong bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${tom ?? ""}`}>{valor}</p>
    </div>
  );
}

function Painel() {
  const hoje = hojeLocal();
  const { data, isLoading } = usePainel();

  const emprestados = data?.equipamentos.filter((e) => e.status === "EMPRESTADO").length ?? 0;
  const disponiveis = data?.equipamentos.filter((e) => e.status === "DISPONIVEL").length ?? 0;
  const atrasados = (data?.abertos ?? []).filter((e) => e.previsto_para < hoje);
  const alunosPendentes = new Set(atrasados.map((e) => e.aluno_id)).size;

  return (
    <AppShell titulo="Painel" descricao={`Referência: ${formatarData(hoje)} (America/Fortaleza)`}>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao rotulo="Emprestados agora" valor={emprestados} />
        <Cartao
          rotulo="Atrasos em aberto"
          valor={atrasados.length}
          tom={atrasados.length ? "text-destructive" : ""}
        />
        <Cartao
          rotulo="Alunos pendentes"
          valor={alunosPendentes}
          tom={alunosPendentes ? "text-destructive" : ""}
        />
        <Cartao rotulo="Equipamentos disponíveis" valor={disponiveis} tom="text-success" />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link
          to="/emprestimos/novo"
          className="flex items-center justify-between rounded border-2 border-primary bg-primary px-5 py-6 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <span className="flex items-center gap-3">
            <PackagePlus className="size-6" /> Novo empréstimo
          </span>
          <ArrowRight className="size-5" />
        </Link>
        <Link
          to="/devolucao"
          className="flex items-center justify-between rounded border-2 border-primary bg-card px-5 py-6 text-lg font-semibold text-primary transition-colors hover:bg-accent"
        >
          <span className="flex items-center gap-3">
            <PackageCheck className="size-6" /> Registrar devolução
          </span>
          <ArrowRight className="size-5" />
        </Link>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Empréstimos em aberto ({data?.abertos.length ?? 0})
      </h2>
      <Tabela>
        <thead>
          <tr>
            <th className={thClasse}>Aluno</th>
            <th className={thClasse}>Matrícula</th>
            <th className={thClasse}>Equipamento</th>
            <th className={thClasse}>Patrimônio</th>
            <th className={thClasse}>Previsto</th>
            <th className={thClasse}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td className={tdClasse} colSpan={6}>
                Carregando…
              </td>
            </tr>
          ) : data?.abertos.length ? (
            data.abertos.map((e) => {
              const atraso = diasAtraso(e.previsto_para, hoje);
              return (
                <tr key={e.id}>
                  <td className={tdClasse}>{e.alunos?.nome}</td>
                  <td className={tdClasse + " font-mono"}>{e.alunos?.matricula}</td>
                  <td className={tdClasse}>{e.equipamentos?.nome}</td>
                  <td className={tdClasse + " font-mono"}>{e.equipamentos?.patrimonio}</td>
                  <td className={tdClasse}>{formatarData(e.previsto_para)}</td>
                  <td className={tdClasse}>
                    {atraso > 0 ? (
                      <Selo tom="erro">{atraso} dia(s) de atraso</Selo>
                    ) : (
                      <Selo tom="ok">Em dia</Selo>
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td className={tdClasse} colSpan={6}>
                Nenhum empréstimo em aberto.
              </td>
            </tr>
          )}
        </tbody>
      </Tabela>
    </AppShell>
  );
}
