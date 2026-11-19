import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importPack, type ImportResult } from '../../engine/pack';
import { Page, TopBar } from '../../ui/kit';

export default function ImportPack() {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportResult[]>([]);
  const [devPacks, setDevPacks] = useState<string[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    fetch('/dev-packs/').then((r) => r.json()).then(setDevPacks).catch(() => undefined);
  }, []);

  async function run(files: Blob[]) {
    setError(null);
    try {
      for (const f of files) {
        const res = await importPack(f, setStatus);
        setDone((d) => [...d, res]);
      }
      setStatus(null);
    } catch (e) {
      setStatus(null);
      setError((e as Error).message);
    }
  }

  return (
    <>
      <TopBar back="/library" kicker="Thư viện" title="Nhập gói nội dung" />
      <Page>
        <h1 className="display vi mt-6 text-[44px]">Nhập gói<br /><i>của bạn.</i></h1>
        <p className="mt-4 max-w-[40ch] text-[15px] leading-relaxed text-muted">
          Mỗi bài trong sách là một tệp <b className="text-ink">edito-a1-uNN.zip</b> do pipeline trên laptop tạo ra.
          Gói chỉ được lưu trong máy này — app không chứa nội dung sách.
        </p>
        <ol className="mt-6 space-y-2 text-[14px] leading-relaxed">
          <li><span className="serif mr-2 text-xl text-[var(--accent)]">1</span>Trên laptop: gửi các tệp trong <code>D:\French\content\packs</code> sang iPhone (AirDrop hoặc iCloud Drive).</li>
          <li><span className="serif mr-2 text-xl text-[var(--accent)]">2</span>Trên iPhone: bấm nút dưới, chọn tệp trong ứng dụng Tệp (Files).</li>
        </ol>
        <input ref={input} type="file" accept=".zip,application/zip" multiple hidden
          onChange={(e) => e.target.files && run([...e.target.files])} />
        <button className="btn btn-ink mt-8 w-full" onClick={() => input.current?.click()} disabled={!!status}>
          Chọn tệp .zip
        </button>
        {import.meta.env.DEV && devPacks.length > 0 && (
          <div className="mt-4 border hairline p-3">
            <div className="kicker">Chỉ khi chạy trên laptop (dev)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {devPacks.map((p) => (
                <button key={p} className="chip" disabled={!!status}
                  onClick={async () => run([await (await fetch(`/dev-packs/${p}`)).blob()])}>{p}</button>
              ))}
            </div>
          </div>
        )}
        {status && <p className="mt-6 animate-pulse text-[15px]">{status}</p>}
        {error && <p className="mt-6 border-l-4 pl-3 text-[15px]" style={{ borderColor: 'var(--tomato)' }}>{error}</p>}
        {done.length > 0 && (
          <div className="mt-8 border-t-2 pt-4" style={{ borderColor: 'var(--ink)' }}>
            {done.map((d) => (
              <p key={d.packId} className="py-1 text-[15px]">
                ✓ <b>{d.title}</b> — {d.tracks} bài nghe, {d.segments} câu{d.replaced ? ' (đã cập nhật)' : ''}
              </p>
            ))}
            <button className="btn btn-accent mt-4 w-full" onClick={() => nav('/library')}>Mở thư viện</button>
          </div>
        )}
      </Page>
    </>
  );
}
