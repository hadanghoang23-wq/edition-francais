import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importPack, type ImportResult } from '../../engine/pack';
import { ErrorNote, Kicker, Page, TopBar, two } from '../../ui/kit';
import { Icon } from '../../ui/icons';

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
      <TopBar back="/library" kicker="Bibliothèque" title="Nhập gói" />
      <Page>
        <h1 className="t-hero mt-10">Importer<br /><span className="italic">un numéro.</span></h1>
        <p className="t-body measure mt-6 text-ink2">
          Mỗi bài trong sách là một tệp <span className="text-ink">edito-a1-uNN.zip</span> do pipeline trên laptop tạo ra.
          Gói chỉ được lưu trong máy này — app không chứa nội dung sách.
        </p>
        <ol className="mt-8">
          {[
            <>Trên laptop: tải các tệp trong <span className="text-ink">D:\French\content\packs</span> lên iCloud Drive.</>,
            <>Trên iPhone: bấm nút dưới, chọn tệp trong ứng dụng Tệp.</>,
          ].map((s, i) => (
            <li key={i} className="flex gap-4 border-t border-[var(--rule)] py-4 last:border-b">
              <span className="t-num w-6 text-[19px] text-accent">{two(i + 1)}</span><span className="t-small text-ink2">{s}</span>
            </li>
          ))}
        </ol>
        <input ref={input} type="file" accept=".zip,application/zip" multiple hidden
          onChange={(e) => e.target.files && run([...e.target.files])} />
        <button className="btn btn-primary mt-10 w-full" onClick={() => input.current?.click()} disabled={!!status}>
          <Icon name="upload" size={15} />Chọn tệp .zip
        </button>
        {import.meta.env.DEV && devPacks.length > 0 && (
          <div className="mt-8">
            <Kicker>Chỉ khi chạy trên laptop · dev</Kicker>
            <div className="mt-2 flex flex-wrap gap-x-4">
              {devPacks.map((p) => (
                <button key={p} className="btn btn-text !px-0" disabled={!!status}
                  onClick={async () => run([await (await fetch(`/dev-packs/${p}`)).blob()])}>{p}</button>
              ))}
            </div>
          </div>
        )}
        {status && <p className="t-label breathe mt-8">{status}</p>}
        {error && <ErrorNote>{error}</ErrorNote>}
        {done.length > 0 && (
          <div className="mt-10">
            <div className="gold-rule" />
            {done.map((d) => (
              <div key={d.packId} className="flex items-baseline gap-3 border-b border-[var(--rule)] py-4">
                <Icon name="check" size={16} className="text-ok" />
                <span className="t-fr-sm flex-1 italic">{d.title}</span>
                <span className="t-meta">{d.tracks} bài nghe · {d.segments} câu{d.replaced ? ' · đã cập nhật' : ''}</span>
              </div>
            ))}
            <button className="btn btn-primary mt-8 w-full" onClick={() => nav('/library')}>Mở thư viện</button>
          </div>
        )}
      </Page>
    </>
  );
}
