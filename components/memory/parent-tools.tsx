"use client";

type Props = {
  resetConfirming: boolean;
  onRequestReset: () => void;
  onCancelReset: () => void;
  onConfirmReset: () => Promise<void> | void;
};

// Parent-only factory reset controls. Kept inside the memory drawer body so
// that the "wipe everything" action has to pass visual inspection of what's
// being wiped (the memory list above).
export function ParentTools({
  resetConfirming,
  onRequestReset,
  onCancelReset,
  onConfirmReset,
}: Props) {
  return (
    <div className="parent-tools">
      <div className="parent-tools-label">parent tools</div>
      <div className="parent-tools-hint">
        to remove one entry, hover the memory card and tap ×.
      </div>
      {resetConfirming ? (
        <div className="parent-tools-confirm">
          <span>
            this wipes EVERY memory and every past session. only use before handing
            Bunny to Yoyo for a fresh start.
          </span>
          <div className="parent-tools-actions">
            <button
              className="parent-reset confirm"
              onClick={() => {
                void onConfirmReset();
              }}
            >
              yes, wipe everything
            </button>
            <button className="parent-reset cancel" onClick={onCancelReset}>
              cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="parent-reset" onClick={onRequestReset}>
          wipe every memory (factory reset)
        </button>
      )}
    </div>
  );
}
