import { useEffect, useState } from 'react';
import { createEmptyCard } from 'ts-fsrs';
import { db } from '../../engine/db';
import { buildLookup, invalidateLookup, lookupWord, normWord, splitWords, type WordEntry } from '../../engine/lookup';
import { GenderTag, GenderWord, Kicker, Sheet } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { AudioChip } from './AudioChip';

/** French text in which every word can be tapped for its meaning, IPA, gender and audio. */
export function TappableText({ text, className = '' }: { text: string; className?: string }) {
  const [map, setMap] = useState<Map<string, WordEntry> | null>(null);
  const [open, setOpen] = useState<{ raw: string; entry: WordEntry | null } | null>(null);
  useEffect(() => { buildLookup().then(setMap); }, []);
  return (
    <>
      <span className={className}>
        {splitWords(text).map((p, i) => p.word ? (
          <span key={i} role="button" tabIndex={0} onClick={() => setOpen({ raw: p.t, entry: map ? lookupWord(map, p.t) : null })}
            className="cursor-pointer rounded-[1px] decoration-[var(--gold)] decoration-1 underline-offset-[5px] hover:underline active:bg-[var(--accent-soft)]">{p.t}</span>
        ) : <span key={i}>{p.t}</span>)}
      </span>
      <WordSheet raw={open?.raw ?? null} entry={open?.entry ?? null} onClose={() => setOpen(null)} />
    </>
  );
}

export function WordSheet({ raw, entry, onClose }: { raw: string | null; entry: WordEntry | null; onClose: () => void }) {
  const [added, setAdded] = useState<string | null>(null);
  const [vi, setVi] = useState('');
  useEffect(() => { setAdded(null); setVi(''); }, [raw]);
  const say = entry ? `${entry.article ? (entry.article.endsWith("'") ? entry.article : entry.article + ' ') : ''}${entry.lemma}` : raw ?? '';

  const addKnown = async () => {
    if (!entry?.refId) return;
    // Bring this word's cards into today's reviews.
    const cards = await db.cards.where('refId').equals(entry.refId).toArray();
    const now = new Date();
    await db.cards.bulkPut(cards.map((c) => (c.introduced ? c : { ...c, introduced: true, due: now })));
    setAdded('Đã đưa từ này vào phần ôn hôm nay.');
  };
  const addCustom = async () => {
    const id = `custom-${Date.now()}`;
    await db.customCards.add({ id, front: normWord(raw ?? ''), back: vi.trim(), createdAt: new Date() });
    for (const type of ['fr-vi', 'vi-fr'] as const) {
      await db.cards.add({ ...createEmptyCard(new Date()), id: `${id}|${type}`, refId: id, deck: 'custom', type, unitId: null, introduced: true, createdAt: new Date() });
    }
    invalidateLookup();
    setAdded('Đã thêm thẻ mới.');
  };

  return (
    <Sheet open={raw !== null} onClose={onClose} title={entry ? (entry.kind === 'verb' ? 'Động từ' : entry.kind === 'country' ? 'Tên nước' : entry.kind === 'nationality' ? 'Quốc tịch' : entry.kind === 'number' ? 'Số' : 'Từ vựng') : 'Chưa có trong từ điển'}>
      {entry ? (
        <>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[40px] leading-none"><GenderWord lemma={entry.lemma} article={entry.article} gender={entry.gender} /></div>
              <div className="ipa mt-2">{entry.ipa}</div>
            </div>
            <AudioChip tts={say} />
          </div>
          {entry.gender && <div className="mt-3"><GenderTag gender={entry.gender} /></div>}
          <p className="mt-4 text-[20px]">{entry.vi}</p>
          {entry.note && <p className="t-small mt-2 text-ink2">{entry.note}</p>}
          {entry.example && <p className="t-fr-sm mt-4 border-t border-[var(--rule)] pt-3">{entry.example}</p>}
          {entry.unitNumber !== undefined && <Kicker className="mt-3">Unité {entry.unitNumber}</Kicker>}
          {entry.refId && entry.kind !== 'custom' && (
            <button className="btn btn-line mb-6 mt-6 w-full" onClick={addKnown} disabled={!!added}><Icon name="plus" size={14} />{added ?? 'Thêm vào phần ôn hôm nay'}</button>
          )}
        </>
      ) : (
        <>
          <div className="serif text-[36px] leading-none">{normWord(raw ?? '')}</div>
          <p className="t-small mt-3 text-ink2">Từ này chưa có trong các bài đã nhập. Bạn có thể nghe giọng máy và tự thêm nghĩa để tạo thẻ.</p>
          <div className="mt-3"><AudioChip tts={normWord(raw ?? '')} /></div>
          <input value={vi} onChange={(e) => setVi(e.target.value)} placeholder="Nghĩa tiếng Việt…" aria-label="Nghĩa tiếng Việt"
            className="mt-4 w-full border-b border-[var(--rule-strong)] bg-transparent py-3 outline-none placeholder:text-faint focus:border-[var(--ink)]" />
          <button className="btn btn-primary mb-6 mt-6 w-full" disabled={!vi.trim() || !!added} onClick={addCustom}>{added ?? 'Tạo thẻ mới'}</button>
        </>
      )}
    </Sheet>
  );
}
