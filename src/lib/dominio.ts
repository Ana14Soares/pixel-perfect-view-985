import { supabase } from "@/integrations/supabase/client";

export const TZ = "America/Fortaleza";

/** Data de hoje no fuso America/Fortaleza, no formato YYYY-MM-DD. */
export function hojeLocal(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Soma dias corridos a uma data YYYY-MM-DD (sem efeito de fuso). */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const base = Date.UTC(a, m - 1, d) + dias * 86400000;
  return new Date(base).toISOString().slice(0, 10);
}

/** Diferença em dias inteiros entre duas datas YYYY-MM-DD (a - b). */
export function diffDias(a: string, b: string): number {
  const p = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(a) - p(b)) / 86400000);
}

/** Dias de atraso: hoje - previsto_para, mínimo 0. */
export function diasAtraso(previstoPara: string, hoje = hojeLocal()): number {
  return Math.max(0, diffDias(hoje, previstoPara));
}

export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatarDataHora(ts: string | null): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(ts));
}

export const PRAZO_PADRAO_DIAS = 7;
export const LIMITE_EMPRESTIMOS = 3;
export const DIAS_POSSIVEL_EXTRAVIO = 30;

export const STATUS_LABEL: Record<string, string> = {
  DISPONIVEL: "Disponível",
  EMPRESTADO: "Emprestado",
  MANUTENCAO: "Manutenção",
  EXTRAVIADO: "Extraviado",
  BAIXADO: "Baixado",
};

export type ResultadoOperacao = {
  ok: boolean;
  codigo?: string;
  mensagem: string;
  emprestimo_id?: string;
};

/** Normaliza a resposta das funções do banco (RPC) em um resultado único. */
export function normalizarResultado(data: unknown, error: unknown): ResultadoOperacao {
  if (error) {
    const msg = (error as { message?: string }).message ?? "Erro inesperado";
    return { ok: false, codigo: "ERRO_INTERNO", mensagem: msg };
  }
  return data as ResultadoOperacao;
}

export async function chamarRpc(
  fn: "fn_emprestar" | "fn_devolver" | "fn_cancelar" | "fn_marcar_extravio" | "fn_alterar_status_equipamento" | "fn_reset_demo",
  args: Record<string, unknown>,
): Promise<ResultadoOperacao> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args);
  return normalizarResultado(data, error);
}
