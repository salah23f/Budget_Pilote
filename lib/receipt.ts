export function buildMissionHash(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  maxBudgetUsd: number;
}) {
  return `${input.origin}-${input.destination}-${input.departDate}-${input.returnDate}-${input.maxBudgetUsd}`;
}

export function buildReceiptPayload(input: {
  missionId: string;
  offerId: string;
  priceUsd: number;
  provider: string;
}) {
  return {
    missionId: input.missionId,
    offerId: input.offerId,
    priceUsd: input.priceUsd,
    provider: input.provider,
    timestamp: new Date().toISOString(),
  };
}
