export const FACT_CALLOUT_GRACE_MS = 2_000;
export const FACT_CALLOUT_TOTAL_MS = 8_100;
export const FACT_CALLOUT_DISMISS_MS = 1_000;

export function shouldFastDismissFactCallout(elapsedMs, input) {
  return (
    elapsedMs >= FACT_CALLOUT_GRACE_MS &&
    (input.left || input.right || input.jump)
  );
}
