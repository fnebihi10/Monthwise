import { euro, months } from './finance';
import { Arrow } from './Arrow';
import type { YearReport } from './reports';
export function YearView({
  year,
  report,
  onMonth,
}: {
  year: number;
  report: YearReport;
  onMonth: (month: number) => void;
}) {
  return (
    <>
      <section className="annual-heading">
        <p>
          <strong>{euro(report.retained)}</strong> retained across the year
        </p>
        <span>
          Income {euro(report.income)} · Expenses {euro(report.spent)}
        </span>
      </section>
      <div className="year-grid">
        {months.map((name, index) => {
          const data = report.months[index];
          return (
            <button
              className="year-card"
              key={name}
              onClick={() => {
                onMonth(index);
              }}
            >
              <span className="eyebrow">
                {String(index + 1).padStart(2, '0')} / {year}
              </span>
              <h2>
                {name}
                <Arrow />
              </h2>
              <dl>
                <div>
                  <dt>In</dt>
                  <dd>{euro(data.income)}</dd>
                </div>
                <div>
                  <dt>Out</dt>
                  <dd>{euro(data.spent)}</dd>
                </div>
                <div className="year-retained">
                  <dt>Stayed</dt>
                  <dd>{euro(data.retained)}</dd>
                </div>
              </dl>
            </button>
          );
        })}
      </div>
    </>
  );
}
