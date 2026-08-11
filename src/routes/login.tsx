import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/useSessao";
import { Campo, botaoClasse, inputClasse } from "@/components/ui-lab";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar | Empréstimo de Equipamentos do Laboratório" },
      {
        name: "description",
        content:
          "Acesso do técnico ao sistema de controle de empréstimo de equipamentos do laboratório.",
      },
      { property: "og:title", content: "Entrar | Empréstimo de Equipamentos" },
      {
        property: "og:description",
        content: "Acesso do técnico ao sistema de empréstimo de equipamentos do laboratório.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { session, carregando } = useSessao();
  const [email, setEmail] = useState("tecnico@lab.edu.br");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!carregando && session) navigate({ to: "/" });
  }, [carregando, session, navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro(error.message);
    setOcupado(false);
  }

  async function criarConta() {
    setOcupado(true);
    setErro(null);
    const { error } = await supabase.auth.signUp({ email, password: senha });
    if (error) setErro(error.message);
    else {
      const { error: e2 } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (e2) setErro(e2.message);
    }
    setOcupado(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded border border-border-strong bg-card p-6 shadow-sm">
        <p className="font-mono text-xs font-semibold tracking-widest text-muted-foreground">
          LAB · EMPRÉSTIMOS
        </p>
        <h1 className="mt-1 text-lg font-semibold">Acesso do técnico</h1>
        <form className="mt-5 space-y-3" onSubmit={entrar}>
          <Campo label="E-mail">
            <input
              className={inputClasse}
              type="email"
              value={email}
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Campo>
          <Campo label="Senha">
            <input
              className={inputClasse}
              type="password"
              value={senha}
              autoComplete="current-password"
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </Campo>
          {erro ? (
            <div className="flex items-start gap-2 rounded border-2 border-destructive bg-destructive/10 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>{erro}</span>
            </div>
          ) : null}
          <button className={botaoClasse + " w-full"} disabled={ocupado} type="submit">
            Entrar
          </button>
        </form>
        <button
          onClick={criarConta}
          disabled={ocupado}
          className="mt-3 w-full text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Primeiro acesso: criar o usuário técnico com estes dados
        </button>
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          Demonstração: <span className="font-mono">tecnico@lab.edu.br</span> /{" "}
          <span className="font-mono">lab123456</span>
        </p>
      </div>
    </div>
  );
}
