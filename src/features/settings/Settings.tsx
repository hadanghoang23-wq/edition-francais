import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { download, exportBackup, importBackup } from '../../engine/backup';
import { db, setSetting } from '../../engine/db';
import { deletePack } from '../../engine/pack';
import { Kicker, Page, Rule, Toast, TopBar } from '../../ui/kit';

function useSetting<T>(key: string, fallback: T): [T, (v: T) => void] {
  const v = useLiveQuery(async () => ((await db.settings.get(key))?.value as T) ?? fallback, [key]);
  return [v ?? fallback, (x: T) => { setSetting(key, x); }];
}

export default function Settings() {
  const [theme, setTheme] = useSetting('theme', 'auto');
  const [minutes, setMinutes] = useSetting('dailyMinutes', 75);
  const [newPerDay, setNewPerDay] = useSetting('newPerDay', 15);
  const [apiKey, setApiKey] = useSetting('apiKey', '');
  const packs = useLiveQuery(() => db.packs.toArray(), []);
  const overrides = useLiveQuery(() => db.overrides.count(), []);
  const [usage, setUsage] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage(`${((e.usage ?? 0) / 1e6).toFixed(0)} MB đang dùng / còn trống khoảng ${(((e.quota ?? 0) - (e.usage ?? 0)) / 1e9).toFixed(1)} GB`));
  }, [packs]);

  const exportOverrides = async () => {
    const rows = await db.overrides.toArray();
    const byTrack: Record<string, { segments: { idx: number; start: number; end: number }[] }> = {};
    for (const r of rows) (byTrack[r.trackId] ??= { segments: [] }).segments.push({ idx: r.idx, start: r.start, end: r.end });
    download(new Blob([JSON.stringify(byTrack, null, 2)], { type: 'application/json' }), `segment-overrides-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const Choice = <T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) => (
    <div className="mt-2 flex flex-wrap gap-2">{options.map(([v, l]) => <button key={String(v)} className="chip" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>
  );

  return (
    <>
      <TopBar back="/" kicker="Édition" title="Cài đặt" />
      <Page>
        <section className="mt-6">
          <Kicker>Giao diện</Kicker>
          <Choice value={theme} onChange={setTheme} options={[['auto', 'Theo máy'], ['light', 'Giấy (sáng)'], ['dark', 'Đêm']]} />
        </section>
        <section className="mt-6">
          <Kicker>Thời gian học mỗi ngày</Kicker>
          <Choice value={minutes} onChange={setMinutes} options={[[45, '45′'], [60, '60′'], [75, '75′'], [90, '90′'], [120, '120′']]} />
        </section>
        <section className="mt-6">
          <Kicker>Thẻ mới mỗi ngày</Kicker>
          <Choice value={newPerDay} onChange={setNewPerDay} options={[[10, '10'], [15, '15'], [20, '20'], [30, '30']]} />
        </section>

        <section className="mt-8">
          <Kicker>Gói nội dung</Kicker>
          <Rule className="mt-1" />
          {packs?.map((p) => (
            <div key={p.packId} className="flex items-center gap-3 border-b hairline py-3">
              <div className="min-w-0 flex-1"><div className="text-[15px] font-medium">Unité {p.manifest.unitNumber} · {p.manifest.title}</div>
                <div className="text-[12px] text-muted">{(p.bytes / 1e6).toFixed(1)} MB · nhập {p.importedAt.toLocaleDateString('vi-VN')} · v{p.manifest.version}</div></div>
              <button className="chip" onClick={async () => { if (confirm(`Xoá nội dung ${p.manifest.title}? Tiến độ và bản ghi của bạn vẫn được giữ.`)) { await deletePack(p.packId); flash('Đã xoá gói.'); } }}>Xoá</button>
            </div>
          ))}
          <Link to="/import" className="btn btn-ghost mt-3 w-full">+ Nhập gói</Link>
          <p className="mt-2 text-[12px] text-muted">{usage}</p>
        </section>

        <section className="mt-8">
          <Kicker>Sao lưu</Kicker>
          <p className="mt-1 text-[13px] text-muted">Toàn bộ tiến độ, thẻ, bản ghi âm. (Không gồm gói nội dung và API key.)</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="btn btn-ink" onClick={async () => { download(await exportBackup(), `edition-backup-${new Date().toISOString().slice(0, 10)}.zip`); }}>Xuất bản sao lưu</button>
            <button className="btn btn-ghost" onClick={() => backupInput.current?.click()}>Khôi phục…</button>
          </div>
          <input ref={backupInput} type="file" accept=".zip" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f || !confirm('Khôi phục sẽ thay thế toàn bộ tiến độ hiện tại. Tiếp tục?')) return;
            try { const r = await importBackup(f); flash(`Đã khôi phục ${r.cards} thẻ, ${r.recordings} bản ghi.`); } catch (err) { flash((err as Error).message); }
          }} />
          <button className="btn btn-ghost mt-2 w-full" disabled={!overrides} onClick={exportOverrides}>Xuất {overrides ?? 0} mốc câu đã chỉnh (cho pipeline)</button>
        </section>

        <section className="mt-8">
          <Kicker>Anthropic API key (không bắt buộc)</Kicker>
          <p className="mt-1 text-[13px] text-muted">Dùng cho phần sửa bài viết bằng AI (giai đoạn 3). Chỉ lưu trong máy này; app vẫn dùng đầy đủ khi không có key.</p>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off"
            className="mt-2 w-full border-b-2 bg-transparent py-2 font-mono text-[14px] outline-none" style={{ borderColor: 'var(--rule)' }} />
        </section>

        <section className="mt-8 text-[13px] leading-relaxed text-muted">
          <Kicker>Về app</Kicker>
          <p className="mt-1">Édition — hệ thống học cá nhân. Nội dung sách chỉ nằm trong các gói bạn tự nhập, lưu trên máy này.</p>
        </section>
      </Page>
      <Toast msg={toast} />
    </>
  );
}
