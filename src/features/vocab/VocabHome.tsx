import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../engine/db';
import { buildQueue, retention } from '../../engine/srs';
import { Empty, GenderWord, Kicker, Loading, Page, Section, TopBar } from '../../ui/kit';
import { Icon } from '../../ui/icons';
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

  if (!counts) return <Loading />;
  const shown = (lex ?? []).filter((x) => !filter || (x.lemma + x.vi).toLowerCase().includes(filter.toLowerCase()));
  const byUnit = new Map<string, LexItem[]>();
  for (const x of shown) byUnit.set(x.unitNumber === null ? 'Thẻ của bạn' : `Unité ${x.unitNumber}`, [...(byUnit.get(x.unitNumber === null ? 'Thẻ của bạn' : `Unité ${x.unitNumber}`) ?? []), x]);

  return (
    <>
      <TopBar kicker="Vocabulaire" title="FSRS" right={<Link to="/cards/add" className="-mr-2 flex h-11 items-center gap-1.5 px-2 t-label !text-ink"><Icon name="plus" size={15} />Thẻ mới</Link>} />
      <Page>
        <h1 className="t-hero mt-10">Les mots</h1>
        {counts.total === 0 && <Empty kicker="Chưa có thẻ" title="Aucun mot encore." body="Thẻ được tạo tự động khi bạn nhập gói nội dung của một bài." to="/import" cta="Nhập gói" />}
        {counts.total > 0 && (
          <>
            <div className="mt-10 grid grid-cols-2">
              <div><div className="t-num text-[72px] leading-none">{counts.due}</div><Kicker className="mt-2">đến hạn ôn</Kicker></div>
              <div className="border-l border-[var(--rule)] pl-6"><div className="t-num text-[72px] leading-none text-accent">{counts.fresh}</div><Kicker className="mt-2">thẻ mới hôm nay</Kicker></div>
            </div>
            <Link to="/cards/review" className={`btn mt-10 w-full ${counts.due + counts.fresh ? 'btn-primary' : 'btn-line'}`}>
              {counts.due + counts.fresh ? `Bắt đầu ôn · ${counts.due + counts.fresh} thẻ` : 'Hôm nay đã xong'}
            </Link>
            <p className="t-meta mt-4">{counts.learned} thẻ đã nhớ lâu (trên ba tuần) · {counts.total} thẻ{counts.ret !== null ? ` · nhớ đúng ${Math.round(counts.ret * 100)}% trong 30 ngày` : ''}</p>
          </>
        )}
        <div className="mt-10 flex items-center gap-6">
          <span className="t-label" style={{ color: 'var(--masc)' }}>masculin</span>
          <span className="t-label" style={{ color: 'var(--fem)' }}>féminin</span>
          <span className="t-label" style={{ color: 'var(--mf)' }}>les deux</span>
        </div>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Tìm một từ…" aria-label="Tìm từ"
          className="mt-4 w-full border-b border-[var(--rule-strong)] bg-transparent py-3 text-[16px] font-light outline-none placeholder:text-faint focus:border-[var(--ink)]" />
        {lex === null && <Loading label="Đang mở từ điển" />}
        {[...byUnit.entries()].map(([label, items]) => (
          <Section key={label} title={label} meta={`${items.length} từ`} className="!mt-10">
            {items.slice(0, filter ? 200 : 60).map((x) => (
              <div key={x.id} className="flex min-h-[64px] items-center gap-3 border-b border-[var(--rule)] py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[21px] leading-tight"><GenderWord lemma={x.lemma} article={x.article} gender={x.gender} /></div>
                  <div className="t-meta mt-0.5 truncate"><span className="ipa">{x.ipa}</span><span className="mx-1.5 text-faint">·</span>{x.vi}{x.loan ? ` · ≈ ${x.loan}` : ''}</div>
                </div>
                <AudioChip tts={(x.article ? `${x.article.endsWith("'") ? x.article : x.article + ' '}` : '') + x.lemma.replace('…', '')} />
              </div>
            ))}
          </Section>
        ))}
      </Page>
    </>
  );
}
