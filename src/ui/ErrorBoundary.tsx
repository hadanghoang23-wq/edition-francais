import { Component, type ReactNode } from 'react';

/** A failing screen shows a composed error page instead of blanking the whole app. Resets on navigation. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto max-w-[600px] px-6 pt-24">
        <div className="t-label !text-accent">Có lỗi</div>
        <div className="t-display mt-4 italic">Une page s'est égarée.</div>
        <div className="gold-rule mt-6 w-12" />
        <p className="t-body measure mt-6 text-ink2">Màn hình này gặp lỗi và không hiển thị được. Dữ liệu và tiến độ của bạn vẫn an toàn.</p>
        <p className="t-meta mt-3 break-words">{this.state.error.message}</p>
        <div className="mt-10 flex gap-3">
          <button className="btn btn-primary" onClick={() => { window.location.hash = '#/'; this.setState({ error: null }); }}>Về Hôm nay</button>
          <button className="btn btn-line" onClick={() => window.location.reload()}>Tải lại</button>
        </div>
      </main>
    );
  }
}
