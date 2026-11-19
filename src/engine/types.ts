/** Content-pack types (pack format 1). Language-agnostic: nothing here is French-specific. */

export interface PackManifest {
  packId: string;
  format: number;
  kind: 'unit' | 'voice';
  lang: string;
  uiLang: string;
  book: { title: string; edition: string; publisher: string };
  unitId: string | null;
  unitNumber: number;
  credit?: string;
  clips?: number;
  title: string;
  version: string;
  createdAt: string;
  pageOffset: number;
  files: Record<string, { bytes: number; sha256: string }>;
}

export interface AudioRef { trackId: string; segIdx: number }
export interface BookExample { fr: string; vi?: string; printedPage?: number; audio?: AudioRef; source?: string }

export interface Segment {
  idx: number;
  start: number;
  end: number;
  text: string;
  speaker: string | null;
  label: string | null;
  line: number;
  vi: string | null;
  confidence: number;
}

export interface Track {
  id: string;
  number: number;
  file: string;
  durationMs: number;
  unitId: string;
  printedPage: number;
  heading: string;
  kind: 'dialogue' | 'items' | 'sequence';
  alignment: { method: string; matchRatio: number };
  segments: Segment[];
}

export type Gender = 'm' | 'f' | 'mf';

export interface Vocab {
  id: string;
  lemma: string;
  article?: string | null;
  gender?: Gender;
  number?: 'pl';
  forms?: { m?: string; f?: string };
  pos: string;
  register?: string;
  ipa: string;
  vi: string;
  viLoanword?: string;
  example?: BookExample | null;
  tags?: string[];
  note?: string;
}

export interface Country {
  id: string;
  country: string;
  article: string;
  gender: Gender;
  number?: 'pl';
  ipa: string;
  vi: string;
  nat: { m: string; f: string; ipaM: string; ipaF: string };
  prep: string;
  note?: string;
  example?: BookExample;
}

export interface NumberItem { n: number; words: string; ipa: string; ipaSource: string; audio: AudioRef | null; listedInBook: boolean }
export interface NumberSet { id: string; from: number; to: number; printedPage: number; trackId: string | null; items: NumberItem[]; noteVi?: string }

export interface Box { id: string; kind: string; printedPage: number; title: string; fr: string[]; vi: string }

export interface Verb {
  id: string;
  infinitive: string;
  ipa: string;
  vi: string;
  printedPage: number;
  group: string;
  present: [string, string, string][] | null;
  noteVi?: string;
}

export interface Drill {
  type: 'choose' | 'gap' | 'order' | 'transform' | 'conjugate';
  promptVi?: string;
  promptFr?: string;
  options?: string[];
  words?: string[];
  answer?: string | number;
  verb?: string;
  persons?: string[];
  source?: string;
}

export interface GrammarPoint {
  id: string;
  title: string;
  printedPage: number;
  rules: { fr: string; vi: string }[];
  examples: (BookExample & { vi: string })[];
  exceptions?: { vi: string }[];
  compareVi?: string;
  compareEn?: string;
  pronunciationVi?: string;
  drills: Drill[];
  verbIds?: string[];
}

export interface PhonPoint {
  id: string;
  title: string;
  printedPage: number;
  trackIds: string[];
  bookRule?: string;
  bookNote?: string;
  explanationVi: string;
  articulationVi: string;
  misleadingMappingVi?: string;
  letters?: { l: string; ipa: string; segIdx: number }[];
  minimalPairs: { a: string; b: string; ipaA: string; ipaB: string; audioA?: AudioRef; audioB?: AudioRef }[];
}

export interface Exercise {
  id: string;
  printedPage: number;
  number: string;
  skill: string;
  trackId?: string;
  instructionFr: string;
  instructionVi: string;
  type: string;
  answers: unknown;
  [k: string]: unknown;
}

export interface DocRef {
  id: string;
  kind: 'dialogue' | 'document' | 'sequence' | 'text' | 'video';
  trackId?: string;
  printedPage: number;
  title: string;
  shadowing: boolean;
  quote?: string;
  available?: boolean;
  lines?: { speaker?: string; text: string; vi: string }[];
}

export interface Unit {
  id: string;
  number: number;
  title: string;
  subtitle?: string;
  titleVi?: string;
  printedPages: [number, number];
  accent: string;
  objectives?: string[];
  sections: { id: string; kind: string; printedPage: number; title: string; trackIds: string[]; needsDvd?: boolean }[];
  docs: DocRef[];
  boxes: Box[];
  vocab: Vocab[];
  countries?: Country[];
  numberSets?: NumberSet[];
  verbs?: Verb[];
  grammar: GrammarPoint[];
  phonetics: PhonPoint[];
  exercises: Exercise[];
  tasks: { id: string; kind: string; printedPage: number; promptFr: string; promptVi: string }[];
  flags: { where: string; issue: string; severity: string }[];
}
