import type { MatchDecision } from "./types";

export function applyUnconfirmedMatchPolicy(args: {
  judge: MatchDecision;
  candidates: Array<{ id: number; distance: number }>;
  acceptUnconfirmedMaxDistance: number;
}): MatchDecision {
  if (!(args.judge.decision === "same" && args.judge.matchId !== null)) {
    return args.judge;
  }

  const matchDistance =
    args.candidates.find((c) => c.id === args.judge.matchId)?.distance ??
    Number.POSITIVE_INFINITY;

  // If the judge didn't include a confirmation marker, treat it as "unconfirmed"
  // (single-provider chain or confirmation disabled). Only accept extremely close matches.
  const confirmedBy = args.judge.confirmedBy;
  if (typeof confirmedBy === "string" && confirmedBy.trim().length > 0) {
    return args.judge;
  }

  if (matchDistance <= args.acceptUnconfirmedMaxDistance) {
    return args.judge;
  }

  return {
    decision: "new",
    matchId: null,
    confidence: 0,
    rationale: `${args.judge.rationale} | Policy override: unconfirmed match distance ${matchDistance.toFixed(
      3
    )} > ${args.acceptUnconfirmedMaxDistance.toFixed(3)}`,
    provider: args.judge.provider,
    confirmations: args.judge.confirmations,
  };
}
