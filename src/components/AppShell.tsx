import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/useSessao";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";

const NAV = [
  { to: "/", label: "Painel" },
  { to: "/emprestimos", label: "Empréstimos" },
  { to: "/atrasos", label: "Atrasos" },
  { to: "/alunos", label: "Alunos" },
  { to: "/equipamentos", label: "Equipamentos" },
  { to: "/admin", label: "Admin" },
] as const;

export function AppShell({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const { session, carregando } = useSessao();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!carregando && !session) navigate({ to: "/login" });
  }, [carregando, session, navigate]);

  if (carregando || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header text-header-foreground print:hidden">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <span className="font-mono text-sm font-semibold tracking-tight">LAB · EMPRÉSTIMOS</span>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {NAV.map((item) => {
              const ativo = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded px-2.5 py-1 transition-colors hover:bg-header-foreground/15",
                    ativo && "bg-header-foreground/20 font-semibold",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="opacity-80">{session.user.email}</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/login" });
              }}
              className="inline-flex items-center gap-1 rounded border border-header-foreground/30 px-2 py-1 hover:bg-header-foreground/15"
            >
              <LogOut className="size-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
            {descricao ? <p className="text-sm text-muted-foreground">{descricao}</p> : null}
          </div>
          {acoes ? <div className="flex flex-wrap gap-2 print:hidden">{acoes}</div> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
