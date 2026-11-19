import type { Exercise } from '../../engine/types';

/** How the book's exercise skills group into the app's practice areas. */
export const GROUPS = {
  nghe: { title: 'Compréhension orale', vi: 'Nghe hiểu', skills: ['comprehension-orale'] },
  doc: { title: 'Compréhension écrite', vi: 'Đọc hiểu', skills: ['comprehension-ecrite'] },
  nguphap: { title: 'Grammaire', vi: 'Ngữ pháp', skills: ['grammaire'] },
  tuvung: { title: 'Vocabulaire', vi: 'Từ vựng', skills: ['vocabulaire'] },
  phonetique: { title: 'Phonétique', vi: 'Ngữ âm', skills: ['phonetique'] },
  noi: { title: 'Production orale', vi: 'Nói', skills: ['production-orale', 'culture'] },
  viet: { title: 'Production écrite', vi: 'Viết', skills: ['production-ecrite'] },
} as const;
export type GroupKey = keyof typeof GROUPS;

export const inGroup = (ex: Exercise, g: GroupKey) => (GROUPS[g].skills as readonly string[]).includes(ex.skill) && !ex.needsDvd;
