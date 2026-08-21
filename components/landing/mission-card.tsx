/* ──────────────────────────────────────────────────────────
   MissionCard — static product mock for the landing hero.
   Pure JSX, no state, no data fetching. This card IS the
   argument: it shows what a running mission looks like.
   DS v3 tokens only.
   ────────────────────────────────────────────────────────── */

export function MissionCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-line-1 bg-ink-800 shadow-elev-3">
      {/* Header — destination, brief, status */}
      <div className="flex items-start justify-between gap-4 p-6 pb-0 sm:p-7 sm:pb-0">
        <div>
          <p className="text-micro uppercase text-pen-3">Mission</p>
          <p className="editorial mt-1 text-[30px] leading-tight sm:text-[34px]">Lisbon</p>
          <p className="num mt-1.5 text-caption text-pen-3">
            Oct 12 – 19 &middot; 2 travelers &middot; Budget 600 &euro;
          </p>
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-caption font-medium text-accent">
          <span className="pulse-live h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          Watching
        </span>
      </div>

      {/* Price — the number that matters, with its verdict */}
      <div className="p-6 sm:p-7">
        <p className="text-micro uppercase text-pen-3">Best fare right now</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <span className="num text-[42px] font-semibold leading-none text-pen-1 sm:text-[48px]">
            512&thinsp;&euro;
          </span>
          <span className="num inline-flex items-center rounded-full bg-success-soft px-2.5 py-1 text-caption font-medium text-success">
            &minus;84&thinsp;&euro; under budget
          </span>
        </div>

        {/* The concierge speaks — one honest recommendation */}
        <div className="mt-5 rounded-md border border-line-1 bg-ink-900 p-4">
          <p className="text-body leading-relaxed text-pen-2">
            <span className="font-semibold text-pen-1">Our call: wait.</span> Prices should dip
            by Aug&nbsp;3.
          </p>
        </div>
      </div>

      {/* Heartbeat — proof the mission is alive */}
      <div className="flex items-center justify-between border-t border-line-1 px-6 py-3.5 sm:px-7">
        <p className="num text-caption text-pen-3">Checked 12 min ago</p>
        <p className="num text-caption text-pen-3">214 fares analyzed</p>
      </div>
    </div>
  );
}
