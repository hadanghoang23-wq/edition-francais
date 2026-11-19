// Settings and labels for the optional AI correction. No SDK or zod here, so screens can import it cheaply.
import { getSetting } from './db';

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5', note: 'chính xác nhất · ~$4 / $20 mỗi triệu token' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', note: 'nhanh hơn · ~$2 / $10' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5', note: 'rẻ nhất · ~$0,10 / $0,50' },
] as const;
export type AiModel = (typeof AI_MODELS)[number]['id'];
export const DEFAULT_MODEL: AiModel = 'claude-opus-5-5';


export const ISSUE_KINDS = ['accent', 'spelling', 'grammar', 'agreement', 'conjugation', 'article', 'elision', 'vocabulary', 'word-order', 'punctuation', 'register'] as const;
export const ISSUE_VI: Record<(typeof ISSUE_KINDS)[number], string> = {
  accent: 'dấu', spelling: 'chính tả', grammar: 'ngữ pháp', agreement: 'hợp giống / số', conjugation: 'chia động từ', article: 'mạo từ',
  elision: 'nối âm / lược âm', vocabulary: 'từ vựng', 'word-order': 'trật tự từ', punctuation: 'dấu câu', register: 'văn phong',
};

export async function getAiConfig() {
  const key = (await getSetting<string>('apiKey', '')).trim();
  const model = await getSetting<AiModel>('aiModel', DEFAULT_MODEL);
  return { key, model, enabled: key.length > 0 };
}
