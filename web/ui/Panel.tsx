import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
export function Panel({
  title,
  eyebrow,
  children,
  onBack,
  onReturn,
  onDismiss,
  wide = false,
  briefing = false,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onBack?: () => void;
  onReturn?: () => void;
  onDismiss?: () => void;
  wide?: boolean;
  briefing?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    return () => {
      el.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`panel ${wide ? "wide" : ""} ${briefing ? "briefing" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onDismiss?.();
      }}
      aria-labelledby="panel-title"
    >
      <header className="panel-header">
        <div className="panel-heading">
          {onBack && (
            <button className="panel-back-button" aria-label="Back to mode selection" onClick={onBack}>
              <ArrowLeft size={17} /> Back
            </button>
          )}
          <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="panel-title">{title}</h1>
          </div>
        </div>
        {onDismiss && (
          <button className="icon-button" aria-label="Close panel" onClick={onDismiss}>
            <X size={21} />
          </button>
        )}
      </header>
      <div className="panel-body">{children}</div>
      {onReturn && (
        <footer className="panel-footer">
          <button className="secondary" onClick={onReturn}>
            <ArrowLeft size={16} /> Return to room
          </button>
          <span>Cursor capture only on this click</span>
        </footer>
      )}
    </dialog>
  );
}
