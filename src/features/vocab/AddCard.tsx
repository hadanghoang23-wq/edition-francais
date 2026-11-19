import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmptyCard } from 'ts-fsrs';
import { db } from '../../engine/db';
import { Kicker, Options, Page, TopBar } from '../../ui/kit';

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
  const field = 'mt-2 w-full border-b border-[var(--rule-strong)] bg-transparent py-3 outline-none placeholder:text-faint focus:border-[var(--ink)]';
  return (
    <>
      <TopBar back="/cards" kicker="Vocabulaire" title="Thẻ mới" />
      <Page>
        <h1 className="t-display mt-10">Un mot à vous</h1>
        <label className="mt-10 block"><Kicker>Tiếng Pháp · kèm mạo từ nếu là danh từ</Kicker>
          <input className={`serif ${field} text-[30px]`} value={front} onChange={(e) => setFront(e.target.value)} placeholder="la boulangerie" autoCapitalize="off" /></label>
        <label className="mt-8 block"><Kicker>Nghĩa tiếng Việt</Kicker>
          <input className={`${field} text-[17px] font-light`} value={back} onChange={(e) => setBack(e.target.value)} placeholder="tiệm bánh mì" /></label>
        <label className="mt-8 block"><Kicker>IPA · không bắt buộc</Kicker>
          <input className={`ipa ${field} !text-[16px]`} value={ipa} onChange={(e) => setIpa(e.target.value)} placeholder="/bu.lɑ̃ʒ.ʁi/" /></label>
        <div className="mt-8"><Kicker>Giống</Kicker>
          <div className="mt-1"><Options value={gender} onChange={setGender} options={[['', 'không'], ['m', 'masculin'], ['f', 'féminin'], ['mf', 'les deux']]} /></div>
        </div>
        <button className="btn btn-primary mt-12 w-full" disabled={!front.trim() || !back.trim()} onClick={save}>Lưu thẻ</button>
      </Page>
    </>
  );
}
