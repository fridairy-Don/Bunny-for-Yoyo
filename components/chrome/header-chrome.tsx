"use client";

type Props = {
  statusLabel: string;
  timeLabel: string;
  timeWarm: string;
  dayNumber: number;
  clientReady: boolean;
};

// Top-of-page status strip. Shows Bunny's current mood label on the left,
// time-of-day copy + "day N" counter on the right. clientReady gates the
// day counter to avoid SSR/CSR hydration mismatch on the first paint.
export function HeaderChrome({
  statusLabel,
  timeLabel,
  timeWarm,
  dayNumber,
  clientReady,
}: Props) {
  return (
    <header className="chrome">
      <div className="wordmark">
        <span className="dot" />
        <span className="status">{statusLabel}</span>
      </div>
      <div className="meta">
        <div className="meta-line">
          <span>{timeLabel}</span>
          <span className="sep" />
          <span>day {clientReady ? dayNumber : 1}</span>
        </div>
        <div className="meta-sub">{timeWarm}</div>
      </div>
    </header>
  );
}
