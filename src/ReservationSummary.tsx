import { euro } from './finance';
import type { reservationTotals } from './planning';

export function ReservationSummary({
  totals,
  onPlan,
}: {
  totals: ReturnType<typeof reservationTotals>;
  onPlan?: () => void;
}) {
  return (
    <section className="reservation-summary" aria-labelledby="unassigned-label">
      <div>
        <h2 id="unassigned-label">Unassigned after reservations</h2>
        <strong>{euro(totals.unassigned)}</strong>
        <p>
          {euro(totals.balance)} across all accounts − {euro(totals.bills)} in this month’s unpaid
          bills − {euro(totals.reserved)} set aside for savings goals.
        </p>
        <p>“What stayed” subtracts recorded expenses from this month’s income.</p>
      </div>
      {onPlan && (
        <button type="button" className="text-button" onClick={onPlan}>
          View bills and savings goals
        </button>
      )}
    </section>
  );
}
