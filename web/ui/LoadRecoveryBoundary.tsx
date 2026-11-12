import { Component, type ReactNode } from "react";

type RecoveryActions = { onReturn: () => void; returnLabel?: string };
export function LoadRecoveryScreen({ onReturn, returnLabel = "Return to mode selection" }: RecoveryActions) {
  return <section className="load-recovery" role="alert" aria-labelledby="load-recovery-title">
    <h2 id="load-recovery-title">This learning environment could not load</h2>
    <p>Check your connection. If the app was updated, reload to get the latest version.</p>
    <p>Reloading or returning clears your current attempt and unsaved progress.</p>
    <button className="secondary" onClick={onReturn}>{returnLabel}</button>
    <button className="primary" onClick={() => window.location.reload()}>Reload app</button>
  </section>;
}

/** Suspense handles pending imports; this boundary handles rejected ones. */
export class LoadRecoveryBoundary extends Component<RecoveryActions & {
  children: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <LoadRecoveryScreen onReturn={this.props.onReturn} returnLabel={this.props.returnLabel} /> : this.props.children;
  }
}
