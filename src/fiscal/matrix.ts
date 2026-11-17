import type { DocType } from "@/domain/states";

// Motor da matriz fiscal: só libera cenário com regra APROVADA e VIGENTE. Nunca inventa parâmetro.

export type FiscalRuleRecord = {
  id: string;
  establishmentId: string;
  docType: DocType;
  purpose: string;
  ufDestino: string | null; // null = qualquer UF
  municipioIbge: string | null; // null = qualquer município
  version: number;
  validFrom: Date;
  validTo: Date | null;
  approvedAt: Date | null;
};

export type RuleContext = {
  establishmentId: string;
  docType: DocType;
  purpose: string;
  ufDestino?: string;
  municipioIbge?: string;
  at: Date;
};

export type Resolution =
  | { status: "ok"; ruleId: string; version: number }
  | { status: "blocked"; reason: string };

const matches = (scope: string | null, value: string | undefined) => scope === null || scope === value;

export function resolveRule(rules: readonly FiscalRuleRecord[], ctx: RuleContext): Resolution {
  const candidates = rules.filter(
    (r) =>
      r.approvedAt !== null &&
      r.establishmentId === ctx.establishmentId &&
      r.docType === ctx.docType &&
      r.purpose === ctx.purpose &&
      r.validFrom <= ctx.at &&
      (r.validTo === null || ctx.at < r.validTo) &&
      matches(r.ufDestino, ctx.ufDestino) &&
      matches(r.municipioIbge, ctx.municipioIbge),
  );

  if (candidates.length === 0) {
    const where = ctx.ufDestino ? ` para entrega em ${ctx.ufDestino}` : "";
    return { status: "blocked", reason: `Não há regra fiscal aprovada e vigente${where}. O responsável fiscal precisa cadastrar e aprovar a regra.` };
  }

  // Regra mais específica vence (município > UF > geral); empate → maior versão.
  const rank = (r: FiscalRuleRecord) => (r.municipioIbge ? 2 : 0) + (r.ufDestino ? 1 : 0);
  candidates.sort((a, b) => rank(b) - rank(a) || b.version - a.version);
  const [best, next] = candidates;
  if (next && rank(next) === rank(best) && next.version === best.version) {
    return { status: "blocked", reason: "Duas regras aprovadas conflitam para este cenário. O responsável fiscal precisa resolver." };
  }
  return { status: "ok", ruleId: best.id, version: best.version };
}
