import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { download, exportBackup, importBackup } from '../../engine/backup';
import { db, setSetting } from '../../engine/db';
import { deletePack } from '../../engine/pack';
import { Kicker, Options, Page, Section, Toast, TopBar, two } from '../../ui/kit';
import { Icon } from '../../ui/icons';

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
    navigator.storage?.estimate?.().then((e) => setUsage(`${((e.usage ?? 0) / 1e6).toFixed(0)} MB đang dùng · còn trống khoảng ${(((e.quota ?? 0) - (e.usage ?? 0)) / 1e9).toFixed(1)} GB`));
  }, [packs]);

  const exportOverrides = async () => {
    const rows = await db.overrides.toArray();
    const byTrack: Record<string, { segments: { idx: number; start: number; end: number }[] }> = {};
    for (const r of rows) (byTrack[r.trackId] ??= { segments: [] }).segments.push({ idx: r.idx, start: r.start, end: r.end });
    download(new Blob([JSON.stringify(byTrack, null, 2)], { type: 'application/json' }), `segment-overrides-${new Date().toISOString().slice(0, 10)}.json`);
  };

  return (
    <>
      <TopBar back="/" kicker="Édition" title="Réglages" />
      <Page>
        <h1 className="t-hero mt-10">Réglages</h1>

        <Section n="01" title="Giao diện">
          <Options value={theme} onChange={setTheme} options={[['auto', 'Theo máy'], ['light', 'Ivoire · sáng'], ['dark', 'Nuit · tối']]} />
        </Section>
        <Section n="02" title="Thời gian học mỗi ngày" meta="phút">
          <Options serif value={minutes} onChange={setMinutes} options={[[45, '45'], [60, '60'], [75, '75'], [90, '90'], [120, '120']]} />
        </Section>
        <Section n="03" title="Thẻ mới mỗi ngày">
          <Options serif value={newPerDay} onChange={setNewPerDay} options={[[10, '10'], [15, '15'], [20, '20'], [30, '30']]} />
        </Section>

        <Section n="04" title="Gói nội dung" meta={usage ? undefined : ''}>
          {packs?.map((p) => (
            <div key={p.packId} className="flex min-h-[64px] items-center gap-4 border-b border-[var(--rule)] py-3">
              <span className="t-num text-[28px] leading-none text-ink2">{p.manifest.kind === 'voice' ? <Icon name="speaker" size={22} /> : two(p.manifest.unitNumber)}</span>
              <div className="min-w-0 flex-1"><div className="t-fr-sm italic">{p.manifest.title}</div>
                <div className="t-meta">{(p.bytes / 1e6).toFixed(1)} MB · nhập {p.importedAt.toLocaleDateString('vi-VN')}{p.manifest.credit ? ` · ${p.manifest.credit}` : ''}</div></div>
              <button className="t-label flex min-h-[44px] items-center px-1 !text-ink2" onClick={async () => { if (confirm(`Xoá nội dung ${p.manifest.title}? Tiến độ và bản ghi của bạn vẫn được giữ.`)) { await deletePack(p.packId); flash('Đã xoá gói.'); } }}>Xoá</button>
            </div>
          ))}
          <Link to="/import" className="btn btn-line mt-6 w-full"><Icon name="plus" size={14} />Nhập gói</Link>
          <p className="t-meta mt-3">{usage}</p>
        </Section>

        <Section n="05" title="Sao lưu">
          <p className="t-small mt-4 text-ink2">Toàn bộ tiến độ, thẻ, bản ghi âm. Không gồm gói nội dung và API key.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="btn btn-primary" onClick={async () => { download(await exportBackup(), `edition-backup-${new Date().toISOString().slice(0, 10)}.zip`); }}><Icon name="download" size={14} />Xuất</button>
            <button className="btn btn-line" onClick={() => backupInput.current?.click()}><Icon name="upload" size={14} />Khôi phục</button>
          </div>
          <input ref={backupInput} type="file" accept=".zip" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f || !confirm('Khôi phục sẽ thay thế toàn bộ tiến độ hiện tại. Tiếp tục?')) return;
            try { const r = await importBackup(f); flash(`Đã khôi phục ${r.cards} thẻ, ${r.recordings} bản ghi.`); } catch (err) { flash((err as Error).message); }
          }} />
          <button className="btn btn-text mt-2 !px-0" disabled={!overrides} onClick={exportOverrides}>Xuất {overrides ?? 0} mốc câu đã chỉnh cho pipeline</button>
        </Section>

        <Section n="06" title="Anthropic API key · không bắt buộc">
          <p className="t-small measure mt-4 text-ink2">Dùng cho phần sửa bài viết bằng AI (giai đoạn 3). Chỉ lưu trong máy này; app vẫn dùng đầy đủ khi không có key.</p>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" aria-label="Anthropic API key"
            className="ipa mt-4 w-full border-b border-[var(--rule-strong)] bg-transparent py-3 !text-[14px] outline-none placeholder:text-faint focus:border-[var(--ink)]" />
        </Section>

        <section className="mt-16 text-center">
          <div className="gold-rule mx-auto w-12" />
          <p className="t-gloss mt-6 text-[20px]">Édition</p>
          <Kicker className="mt-1">Hệ thống học cá nhân</Kicker>
          <p className="t-meta measure mx-auto mt-3">Nội dung sách chỉ nằm trong các gói bạn tự nhập, lưu trên máy này.</p>
        </section>
      </Page>
      <Toast msg={toast} />
    </>
  );
}
