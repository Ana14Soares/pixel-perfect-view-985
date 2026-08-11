import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  Campo,
  ResultadoAlerta,
  Selo,
  Tabela,
  botaoClasse,
  botaoSecundarioClasse,
  inputClasse,
  tdClasse,
  thClasse,
} from "@/components/ui-lab";
import { diasAtraso, hojeLocal, type ResultadoOperacao } from "@/lib/dominio";

export const Route = createFileRoute("/alunos/")({
  head: () => ({
    meta: [
      { title: "Alunos | Laboratório" },
      {
        name: "description",
        content:
          "Cadastro de alunos do laboratório com matrícula única, indicador de pendência e histórico de empréstimos.",
      },
      { property: "og:title", content: "Cadastro de alunos" },
      {
        property: "og:description",
        content: "Cadastro prévio obrigatório para retirada de equipamentos.",
      },
    ],
  }),
  component: Alunos,
});

function Alunos() {
  const hoje = hojeLocal();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [res, setRes] = useState<ResultadoOperacao | null>(null);
  const [form, setForm] = useState({ matricula: "", nome: "", email: "", telefone: "" });

  const alunos = useQuery({
    queryKey: ["alunos-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id,matricula,nome,email,telefone,ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const abertos = useQuery({
    queryKey: ["abertos-por-aluno"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emprestimos")
        .select("aluno_id,previsto_para")
        .is("devolvido_em", null)
        .is("cancelado_em", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("alunos").insert({
        matricula: form.matricula.trim(),
        nome: form.nome.trim(),
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setRes({ ok: true, mensagem: "Aluno cadastrado." });
      setForm({ matricula: "", nome: "", email: "", telefone: "" });
      qc.invalidateQueries();
    },
    onError: (e: { message?: string; code?: string }) =>
      setRes({
        ok: false,
        codigo: e.code === "23505" ? "MATRICULA_DUPLICADA" : "ERRO_CADASTRO",
        mensagem: e.code === "23505" ? "Já existe aluno com esta matrícula." : (e.message ?? ""),
      }),
  });

  const alternarAtivo = useMutation({
    mutationFn: async (v: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("alunos").update({ ativo: v.ativo }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  const t = busca.trim().toLowerCase();
  const lista = (alunos.data ?? []).filter(
    (a) => !t || a.nome.toLowerCase().includes(t) || a.matricula.toLowerCase().includes(t),
  );

  return (
    <AppShell titulo="Alunos" descricao="Cadastro prévio obrigatório para qualquer empréstimo.">
      <div className="space-y-4">
        {res ? <ResultadoAlerta res={res} /> : null}

        <section className="rounded border border-border-strong bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Novo aluno
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo label="Matrícula *">
              <input
                className={inputClasse}
                value={form.matricula}
                onChange={(e) => setForm({ ...form, matricula: e.target.value })}
              />
            </Campo>
            <Campo label="Nome *">
              <input
                className={inputClasse}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </Campo>
            <Campo label="E-mail">
              <input
                className={inputClasse}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Campo>
            <Campo label="Telefone">
              <input
                className={inputClasse}
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </Campo>
          </div>
          <button
            className={botaoClasse + " mt-3"}
            disabled={!form.matricula.trim() || !form.nome.trim() || criar.isPending}
            onClick={() => criar.mutate()}
          >
            Cadastrar aluno
          </button>
        </section>

        <input
          className={inputClasse + " max-w-xs"}
          placeholder="Buscar por matrícula ou nome"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <Tabela>
          <thead>
            <tr>
              <th className={thClasse}>Matrícula</th>
              <th className={thClasse}>Nome</th>
              <th className={thClasse}>Contato</th>
              <th className={thClasse}>Situação</th>
              <th className={thClasse}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((a) => {
              const meus = (abertos.data ?? []).filter((e) => e.aluno_id === a.id);
              const vencidos = meus.filter((e) => e.previsto_para < hoje);
              return (
                <tr key={a.id}>
                  <td className={tdClasse + " font-mono"}>{a.matricula}</td>
                  <td className={tdClasse}>{a.nome}</td>
                  <td className={tdClasse + " text-xs"}>
                    {a.email ?? "—"}
                    <span className="block">{a.telefone ?? ""}</span>
                  </td>
                  <td className={tdClasse}>
                    <div className="flex flex-wrap gap-1">
                      {!a.ativo ? <Selo tom="erro">Inativo</Selo> : null}
                      {vencidos.length ? (
                        <Selo tom="erro">
                          Pendente ({Math.max(...vencidos.map((v) => diasAtraso(v.previsto_para, hoje)))}d)
                        </Selo>
                      ) : (
                        <Selo tom="ok">Sem pendência</Selo>
                      )}
                      <Selo>{meus.length} em aberto</Selo>
                    </div>
                  </td>
                  <td className={tdClasse}>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/alunos/$alunoId"
                        params={{ alunoId: a.id }}
                        className={botaoSecundarioClasse + " px-2 py-1 text-xs"}
                      >
                        Histórico
                      </Link>
                      <button
                        className={botaoSecundarioClasse + " px-2 py-1 text-xs"}
                        onClick={() => alternarAtivo.mutate({ id: a.id, ativo: !a.ativo })}
                      >
                        {a.ativo ? "Inativar" : "Reativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      </div>
    </AppShell>
  );
}
