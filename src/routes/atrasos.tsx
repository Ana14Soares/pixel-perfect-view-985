import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Selo, Tabela, botaoSecundarioClasse, tdClasse, thClasse } from "@/components/ui-lab";
import { DIAS_POSSIVEL_EXTRAVIO, diasAtraso, formatarData, hojeLocal } from "@/lib/dominio";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/atrasos")({
  head: () => ({
    meta: [
      { title: "Relatório de atrasos | Laboratório" },
      {
        name: "description",
        content:
          "Relatório de empréstimos vencidos em aberto com dias de atraso, contato do aluno, exportação CSV e impressão.",
      },
      { property: "og:title", content: "Relatório de atrasos do laboratório" },
      {
        property: "og:description",
        content: "Empréstimos vencidos em aberto, ordenados por dias de atraso.",
      },
    ],
  }),
  component: Atrasos,
});

function Atrasos() {
  const hoje = hojeLocal();
  const [incluirRegularizados, setIncluirRegularizados] = useState(false);

  const lista = useQuery({
    queryKey: ["atrasos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emprestimos")
        .select(
          "id,previsto_para,devolvido_em,cancelado_em,alunos(nome,matricula,email,telefone),equipamentos(nome,patrimonio)",
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const linhas = (lista.data ?? [])
    .filter((e) => {
      if (e.cancelado_em) return false;
      if (!e.devolvido_em) return e.previsto_para < hoje;
      if (!incluirRegularizados) return false;
      return e.devolvido_em.slice(0, 10) > e.previsto_para;
    })
    .map((e) => ({
      ...e,
      atraso: e.devolvido_em
        ? Math.max(0, Math.round((Date.parse(e.devolvido_em.slice(0, 10)) - Date.parse(e.previsto_para)) / 86400000))
        : diasAtraso(e.previsto_para, hoje),
      regularizado: !!e.devolvido_em,
    }))
    .sort((a, b) => b.atraso - a.atraso);

  function exportarCsv() {
    const cab = [
      "aluno",
      "matricula",
      "email",
      "telefone",
      "equipamento",
      "patrimonio",
      "previsto_para",
      "dias_atraso",
      "situacao",
    ];
    const corpo = linhas.map((l) =>
      [
        l.alunos?.nome ?? "",
        l.alunos?.matricula ?? "",
        l.alunos?.email ?? "",
        l.alunos?.telefone ?? "",
        l.equipamentos?.nome ?? "",
        l.equipamentos?.patrimonio ?? "",
        l.previsto_para,
        String(l.atraso),
        l.regularizado ? "REGULARIZADO" : "EM ABERTO",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const csv = "\uFEFF" + [cab.join(";"), ...corpo].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `atrasos-${hoje}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      titulo="Relatório de atrasos"
      descricao={`Empréstimos vencidos em aberto · referência ${formatarData(hoje)}`}
      acoes={
        <>
          <label className="flex items-center gap-2 rounded border border-border-strong bg-card px-3 py-1.5 text-sm">
            <input
              type="checkbox"
              checked={incluirRegularizados}
              onChange={(e) => setIncluirRegularizados(e.target.checked)}
            />
            Incluir atrasos já regularizados
          </label>
          <button className={botaoSecundarioClasse} onClick={exportarCsv}>
            <Download className="size-4" /> Exportar CSV
          </button>
          <button className={botaoSecundarioClasse} onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir
          </button>
        </>
      }
    >
      <Tabela>
        <thead>
          <tr>
            <th className={thClasse}>Aluno</th>
            <th className={thClasse}>Matrícula</th>
            <th className={thClasse}>Contato</th>
            <th className={thClasse}>Equipamento</th>
            <th className={thClasse}>Patrimônio</th>
            <th className={thClasse}>Data prevista</th>
            <th className={thClasse}>Dias de atraso</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id}>
              <td className={tdClasse}>
                {l.alunos?.nome}
                {l.regularizado ? (
                  <span className="ml-2">
                    <Selo>Regularizado</Selo>
                  </span>
                ) : null}
              </td>
              <td className={tdClasse + " font-mono"}>{l.alunos?.matricula}</td>
              <td className={tdClasse + " text-xs"}>
                {l.alunos?.email ?? "—"}
                <span className="block">{l.alunos?.telefone ?? ""}</span>
              </td>
              <td className={tdClasse}>{l.equipamentos?.nome}</td>
              <td className={tdClasse + " font-mono"}>{l.equipamentos?.patrimonio}</td>
              <td className={tdClasse}>{formatarData(l.previsto_para)}</td>
              <td className={tdClasse}>
                <span className="mr-2 font-semibold text-destructive">{l.atraso}</span>
                {l.atraso > DIAS_POSSIVEL_EXTRAVIO ? <Selo tom="alerta">Possível extravio</Selo> : null}
              </td>
            </tr>
          ))}
          {linhas.length === 0 ? (
            <tr>
              <td className={tdClasse} colSpan={7}>
                Nenhum atraso.
              </td>
            </tr>
          ) : null}
        </tbody>
      </Tabela>
    </AppShell>
  );
}
