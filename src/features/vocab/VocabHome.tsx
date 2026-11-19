import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../engine/db';
import { buildQueue, retention } from '../../engine/srs';
import { Empty, GenderWord, Kicker, Page, Rule, TopBar } from '../../ui/kit';
import { AudioChip } from '../shared/AudioChip';
import { loadLexicon, type LexItem } from './lexicon';

export default function VocabHome() {
  const counts = useLiveQuery(async () => {
    const q = await buildQueue();
    const total = await db.cards.count();
    const learned = await db.cards.filter((c) => c.introduced && c.stability > 21).count();
    return { due: q.due.length, fresh: q.fresh.length, total, learned, ret: await retention() };
  }, []);
  const [lex, setLex] = useState<LexItem[] | null>(null);
  const [filter, setFilter] = useState('');
  useEffect(() => { loadLexicon().then((m) => setLex([...m.values()])); }, []);

  const shown = (lex ?? []).filter((x) => !filter || (x.lemma + x.vi).toLowerCase().includes(filter.toLowerCase()));
  const byUnit = new Map<string, LexItem[]>();
  for (const x of shown) byUnit.set(x.unitNumber === null ? 'Thẻ của bạn' : `Unité ${x.unitNumber}`, [...(byUnit.get(x.unitNumber === null ? 'Thẻ của bạn' : `Unité ${x.unitNumber}`) ?? []), x]);

  return (
    <>
      <TopBar kicker="Từ vựng · FSRS" title="Thẻ từ" right={<Link to="/cards/add" className="chip">+ Thẻ mới</Link>} />
      <Page>
        {counts && counts.total === 0 && <Empty title="Chưa có thẻ." body="Thẻ được tạo tự động khi bạn nhập gói nội dung của một bài." to="/import" cta="Nhập gói" />}
        {counts && counts.total > 0 && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-px bg-[var(--rule)]">
              <div className="bg-paper py-5"><div className="display text-[64px] leading-none">{counts.due}</div><Kicker className="mt-1">đến hạn ôn</Kicker></div>
              <div className="bg-paper py-5 pl-4"><div className="display text-[64px] leading-none text-[var(--accent)]">{counts.fresh}</div><Kicker className="mt-1">thẻ mới hôm nay</Kicker></div>
            </div>
            <Link to="/cards/review" className={`btn mt-4 w-full ${counts.due + counts.fresh ? 'btn-accent' : 'btn-ghost'}`}>
              {counts.due + counts.fresh ? `Bắt đầu ôn · ${counts.due + counts.fresh} thẻ` : 'Hôm nay đã xong ✓'}
            </Link>
            <p className="mt-3 text-[13px] text-muted">{counts.learned} thẻ đã nhớ lâu (&gt; 3 tuần) · {counts.total} thẻ{counts.ret !== null ? ` · nhớ đúng ${Math.round(counts.ret * 100)}% trong 30 ngày` : ''}</p>
          </>
        )}
        <div className="mt-6 flex gap-4 text-[12px]"><span className="g-m">● giống đực</span><span className="g-f">● giống cái</span><span className="g-mf">● cả hai</span></div>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Tìm từ…" className="mt-4 w-full border-b hairline bg-transparent py-2 text-[16px] outline-none" />
        {[...byUnit.entries()].map(([label, items]) => (
          <section key={label} className="mt-6">
            <Kicker>{label} · {items.length}</Kicker>
            <Rule className="mt-1" />
            {items.slice(0, filter ? 200 : 60).map((x) => (
              <div key={x.id} className="flex items-center gap-3 border-b hairline py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="serif text-[21px] leading-tight"><GenderWord lemma={x.lemma} article={x.article} gender={x.gender} /></div>
                  <div className="truncate text-[13px] text-muted"><span className="ipa">{x.ipa}</span> · {x.vi}{x.loan ? ` · ≈ ${x.loan}` : ''}</div>
                </div>
                <AudioChip tts={(x.article ? `${x.article.endsWith("'") ? x.article : x.article + ' '}` : '') + x.lemma.replace('…', '')} />
              </div>
            ))}
          </section>
        ))}
      </Page>
    </>
  );
}
