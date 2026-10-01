import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
export function Panel({
  title,
  eyebrow,
  children,
  onReturn,
  onDismiss,
  wide = false,
  briefing = false,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
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
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="panel-title">{title}</h1>
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
