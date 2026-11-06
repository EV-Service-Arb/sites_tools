import "server-only";
import { declarationProblem, ingestBody, siteEvent, uuidV7, type ExperimentDeclaration, type IngestRequest } from "@evinvest/sites-contract";
import type { LeadWebhook } from "./lead-webhook";

/**
 * One experiment as the code declares it — the shape of an
 * `@evinvest/experiments` spec, so the brand's `as const` config is passed
 * as is. `variants[0]` is the control. No weights: the code splits equally,
 * and re-weighting is the panel's override.
 */
export interface DeclaredExperiment {
  readonly variants: readonly string[];
  readonly enabled?: boolean;
  readonly holdout?: number;
}

export type ExperimentsDeclaration = Readonly<Record<string, DeclaredExperiment>>;

export interface DeclarationContext {
  brandId: string;
  /** The key id the batch is signed with: the panel refuses any other `source.id`. */
  sourceId: string;
  at: Date;
  /** One line of hypothesis per key, at most 200 characters. */
  summaries?: Readonly<Record<string, string>>;
}

/**
 * The ingest body declaring the brand's experiments, and what was left out of
 * it with why. A fresh UUIDv7 each call: every start is a declaration of its
 * own, and the panel keeps the latest by `occurredAt`.
 */
export function experimentsDeclaredBody(
  experiments: ExperimentsDeclaration,
  ctx: DeclarationContext,
): { body: IngestRequest; skipped: { key: string; why: string }[] } {
  const declared: ExperimentDeclaration[] = [];
  const skipped: { key: string; why: string }[] = [];
  for (const [key, spec] of Object.entries(experiments)) {
    const summary = ctx.summaries && Object.hasOwn(ctx.summaries, key) ? ctx.summaries[key] : undefined;
    const declaration: ExperimentDeclaration = {
      key,
      variants: [...spec.variants],
      weights: spec.variants.map(() => 1),
      enabled: spec.enabled ?? true,
      ...(spec.holdout !== undefined ? { holdout: spec.holdout } : {}),
      ...(summary !== undefined && summary.trim() !== "" ? { summary } : {}),
    };
    const why = declarationProblem(declaration);
    if (why === null) declared.push(declaration);
    else skipped.push({ key, why });
  }
  const head = { id: uuidV7(ctx.at.getTime()), occurredAt: ctx.at, sourceId: ctx.sourceId, subject: { brandId: ctx.brandId } };
  return { body: ingestBody(siteEvent("experiments.declared@1", head, { experiments: declared })), skipped };
}

/** What `declareExperiments` did: queued (`row`), or why not. */
export type DeclareOutcome = { kind: "queued"; row: number; skipped: { key: string; why: string }[] } | { kind: "off" } | { kind: "failed" };

export interface DeclareOptions {
  summaries?: Readonly<Record<string, string>>;
  log?: Pick<Console, "warn" | "error">;
}

/**
 * Tells the panel which experiments this build runs — for `instrumentation.ts`
 * `register()`, once per start:
 *
 * ```ts
 * export async function register() {
 *   if (process.env.NEXT_RUNTIME !== "nodejs") return;
 *   declareExperiments(webhook, experiments, { summaries: { hero: "A shorter form converts better" } });
 * }
 * ```
 *
 * Queued in the lead webhook's outbox, signed and retried like a lead, and
 * sent at once. It never throws and never holds the start: a webhook that is
 * off (no `LEAD_WEBHOOK_URL`) or cannot be built is logged and skipped — the
 * panel keeps the brand's last declaration. An experiment the panel would
 * refuse is left out, logged.
 */
export function declareExperiments(
  webhook: () => LeadWebhook | null,
  experiments: ExperimentsDeclaration,
  options: DeclareOptions = {},
): DeclareOutcome {
  const log = options.log ?? console;
  let hook: LeadWebhook | null;
  try {
    hook = webhook();
  } catch (error) {
    log.error("experiments: the lead webhook could not be built, nothing declared to the panel", error);
    return { kind: "failed" };
  }
  if (!hook) return { kind: "off" };
  let outcome: DeclareOutcome;
  try {
    outcome = hook.declareExperiments(experiments, options.summaries ?? {});
  } catch (error) {
    log.error("experiments: the declaration could not be queued", error);
    return { kind: "failed" };
  }
  if (outcome.kind === "queued") {
    for (const { key, why } of outcome.skipped) log.error(`experiments: ${key} is not declared to the panel: ${why}`);
    hook.tick().catch((error: unknown) => log.error("experiments: sending the declaration failed; the outbox retries it", error));
  }
  return outcome;
}
