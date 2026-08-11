import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  Campo,
  ResultadoAlerta,
  StatusEquipamento,
  Tabela,
  botaoClasse,
  botaoSecundarioClasse,
  inputClasse,
  tdClasse,
  thClasse,
} from "@/components/ui-lab";
import { STATUS_LABEL, chamarRpc, type ResultadoOperacao } from "@/lib/dominio";

export const Route = createFileRoute("/equipamentos/")({
  head: () => ({
    meta: [
      { title: "Equipamentos | Laboratório" },
      {
        name: "description",
        content:
          "Cadastro de equipamentos por patrimônio individual, com status disponível, emprestado, manutenção, extraviado ou baixado.",
      },
      { property: "og:title", content: "Cadastro de equipamentos" },
      {
        property: "og:description",
        content: "Cada patrimônio é uma unidade individual identificável.",
      },
    ],
  }),
  component: Equipamentos,
});

const STATUS = ["DISPONIVEL", "EMPRESTADO", "MANUTENCAO", "EXTRAVIADO", "BAIXADO"] as const;

function Equipamentos() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [res, setRes] = useState<ResultadoOperacao | null>(null);
  const [form, setForm] = useState({
    patrimonio: "",
    nome: "",
    categoria: "",
    observacoes: "",
  });

  const equipamentos = useQuery({
    queryKey: ["equipamentos-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos")
        .select("id,patrimonio,nome,categoria,status,observacoes")
        .order("patrimonio");
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("equipamentos").insert({
        patrimonio: form.patrimonio.trim(),
        nome: form.nome.trim(),
        categoria: form.categoria.trim(),
        observacoes: form.observacoes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setRes({ ok: true, mensagem: "Equipamento cadastrado como DISPONIVEL." });
      setForm({ patrimonio: "", nome: "", categoria: "", observacoes: "" });
      qc.invalidateQueries();
    },
    onError: (e: { message?: string; code?: string }) =>
      setRes({
        ok: false,
        codigo: e.code === "23505" ? "PATRIMONIO_DUPLICADO" : "ERRO_CADASTRO",
        mensagem:
          e.code === "23505" ? "Já existe equipamento com este patrimônio." : (e.message ?? ""),
      }),
  });

  const alterarStatus = useMutation({
    mutationFn: async (v: { id: string; status: string }) =>
      chamarRpc("fn_alterar_status_equipamento", {
        p_equipamento_id: v.id,
        p_status: v.status,
      }),
    onSuccess: (r) => {
      setRes(r);
      qc.invalidateQueries();
    },
  });

  const t = busca.trim().toLowerCase();
  const lista = (equipamentos.data ?? []).filter(
    (e) =>
      !t ||
      e.patrimonio.toLowerCase().includes(t) ||
      e.nome.toLowerCase().includes(t) ||
      e.categoria.toLowerCase().includes(t),
  );

  return (
    <AppShell
      titulo="Equipamentos"
      descricao="Cada patrimônio é uma unidade individual. Itens com histórico não são excluídos: marque BAIXADO."
    >
      <div className="space-y-4">
        {res ? <ResultadoAlerta res={res} /> : null}

        <section className="rounded border border-border-strong bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Novo equipamento
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo label="Patrimônio *">
              <input
                className={inputClasse}
                value={form.patrimonio}
                onChange={(e) => setForm({ ...form, patrimonio: e.target.value })}
              />
            </Campo>
            <Campo label="Nome *">
              <input
                className={inputClasse}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </Campo>
            <Campo label="Categoria *">
              <input
                className={inputClasse}
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              />
            </Campo>
            <Campo label="Observações">
              <input
                className={inputClasse}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </Campo>
          </div>
          <button
            className={botaoClasse + " mt-3"}
            disabled={
              !form.patrimonio.trim() || !form.nome.trim() || !form.categoria.trim() || criar.isPending
            }
            onClick={() => criar.mutate()}
          >
            Cadastrar equipamento
          </button>
        </section>

        <input
          className={inputClasse + " max-w-xs"}
          placeholder="Buscar por patrimônio, nome ou categoria"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <Tabela>
          <thead>
            <tr>
              <th className={thClasse}>Patrimônio</th>
              <th className={thClasse}>Nome</th>
              <th className={thClasse}>Categoria</th>
              <th className={thClasse}>Status</th>
              <th className={thClasse}>Alterar status</th>
              <th className={thClasse}></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id}>
                <td className={tdClasse + " font-mono"}>{e.patrimonio}</td>
                <td className={tdClasse}>
                  {e.nome}
                  {e.observacoes ? (
                    <span className="block text-xs text-muted-foreground">{e.observacoes}</span>
                  ) : null}
                </td>
                <td className={tdClasse}>{e.categoria}</td>
                <td className={tdClasse}>
                  <StatusEquipamento status={e.status} />
                </td>
                <td className={tdClasse}>
                  <select
                    className={inputClasse + " w-40"}
                    value={e.status}
                    disabled={e.status === "EMPRESTADO"}
                    onChange={(ev) => alterarStatus.mutate({ id: e.id, status: ev.target.value })}
                  >
                    {STATUS.map((s) => (
                      <option key={s} value={s} disabled={s === "EMPRESTADO"}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={tdClasse}>
                  <Link
                    to="/equipamentos/$equipamentoId"
                    params={{ equipamentoId: e.id }}
                    className={botaoSecundarioClasse + " px-2 py-1 text-xs"}
                  >
                    Histórico
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </div>
    </AppShell>
  );
}
