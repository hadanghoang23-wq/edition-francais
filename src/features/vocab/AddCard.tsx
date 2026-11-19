import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmptyCard } from 'ts-fsrs';
import { db } from '../../engine/db';
import { Page, TopBar } from '../../ui/kit';

export default function AddCard() {
  const nav = useNavigate();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [ipa, setIpa] = useState('');
  const [gender, setGender] = useState<'' | 'm' | 'f' | 'mf'>('');
  const save = async () => {
    const id = `custom-${Date.now()}`;
    await db.customCards.add({ id, front: front.trim(), back: back.trim(), ipa: ipa.trim() || undefined, gender: gender || undefined, createdAt: new Date() });
    for (const type of ['fr-vi', 'vi-fr'] as const) {
      await db.cards.add({ ...createEmptyCard(new Date()), id: `${id}|${type}`, refId: id, deck: 'custom', type, unitId: null, introduced: false, createdAt: new Date() });
    }
    nav('/cards');
  };
  const field = 'mt-1 w-full border-b-2 bg-transparent py-2 text-[18px] outline-none';
  return (
    <>
      <TopBar back="/cards" kicker="Từ vựng" title="Thẻ mới" />
      <Page>
        <label className="mt-6 block"><span className="kicker">Tiếng Pháp (kèm mạo từ nếu là danh từ)</span>
          <input className={`serif ${field} text-[26px]`} style={{ borderColor: 'var(--ink)' }} value={front} onChange={(e) => setFront(e.target.value)} placeholder="la boulangerie" autoCapitalize="off" /></label>
        <label className="mt-6 block"><span className="kicker">Nghĩa tiếng Việt</span>
          <input className={field} style={{ borderColor: 'var(--rule)' }} value={back} onChange={(e) => setBack(e.target.value)} placeholder="tiệm bánh mì" /></label>
        <label className="mt-6 block"><span className="kicker">IPA (không bắt buộc)</span>
          <input className={`ipa ${field}`} style={{ borderColor: 'var(--rule)' }} value={ipa} onChange={(e) => setIpa(e.target.value)} placeholder="/bu.lɑ̃ʒ.ʁi/" /></label>
        <div className="mt-6"><span className="kicker">Giống</span>
          <div className="mt-2 flex gap-2">
            {([['', '—'], ['m', 'đực'], ['f', 'cái'], ['mf', 'cả hai']] as const).map(([g, l]) => <button key={g} className="chip" aria-pressed={gender === g} onClick={() => setGender(g)}>{l}</button>)}
          </div>
        </div>
        <button className="btn btn-ink mt-10 w-full" disabled={!front.trim() || !back.trim()} onClick={save}>Lưu thẻ</button>
      </Page>
    </>
  );
}
