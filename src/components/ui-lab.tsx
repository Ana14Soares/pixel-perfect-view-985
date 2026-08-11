import type { ResultadoOperacao } from "@/lib/dominio";
import { STATUS_LABEL } from "@/lib/dominio";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function ResultadoAlerta({ res }: { res: ResultadoOperacao | null }) {
  if (!res) return null;
  if (res.ok) {
    return (
      <div className="flex items-start gap-2 rounded border-2 border-success bg-success/10 px-3 py-2 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        <p className="font-medium">{res.mensagem}</p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded border-2 border-destructive bg-destructive/10 px-3 py-2">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="space-y-0.5">
        <p className="codigo-erro text-base text-destructive">{res.codigo}</p>
        <p className="text-sm text-foreground">{res.mensagem}</p>
      </div>
    </div>
  );
}

const STATUS_CLASSE: Record<string, string> = {
  DISPONIVEL: "border-success text-success",
  EMPRESTADO: "border-info text-info",
  MANUTENCAO: "border-warning text-warning-foreground bg-warning/20",
  EXTRAVIADO: "border-destructive text-destructive",
  BAIXADO: "border-border-strong text-muted-foreground",
};

export function StatusEquipamento({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase",
        STATUS_CLASSE[status] ?? "border-border-strong",
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Selo({
  tom = "neutro",
  children,
}: {
  tom?: "neutro" | "alerta" | "erro" | "ok";
  children: React.ReactNode;
}) {
  const tons = {
    neutro: "border-border-strong text-muted-foreground",
    alerta: "border-warning bg-warning/20 text-warning-foreground",
    erro: "border-destructive bg-destructive/10 text-destructive",
    ok: "border-success text-success",
  } as const;
  return (
    <span
      className={cn(
        "inline-block rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase",
        tons[tom],
      )}
    >
      {children}
    </span>
  );
}

export function Campo({
  label,
  children,
  dica,
}: {
  label: string;
  children: React.ReactNode;
  dica?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
      {dica ? <span className="block text-xs text-muted-foreground">{dica}</span> : null}
    </label>
  );
}

export const inputClasse =
  "w-full rounded border border-input bg-card px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export const botaoClasse =
  "inline-flex items-center justify-center gap-1.5 rounded border border-transparent bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50";

export const botaoSecundarioClasse =
  "inline-flex items-center justify-center gap-1.5 rounded border border-border-strong bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50";

export const botaoPerigoClasse =
  "inline-flex items-center justify-center gap-1.5 rounded border border-destructive bg-card px-2 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50";

export function Tabela({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border border-border-strong bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export const thClasse =
  "border-b border-border-strong bg-surface px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
export const tdClasse = "border-b border-border px-3 py-2 align-middle";
