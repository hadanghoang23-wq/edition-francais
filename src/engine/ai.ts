// Optional AI writing correction with the learner's own Anthropic API key.
// The key lives only in this device's IndexedDB and is sent only to api.anthropic.com.
// The SDK is loaded on demand, so the app never downloads it unless correction is used.
import { z } from 'zod';
import { getSetting, setSetting } from './db';
import { ISSUE_KINDS, getAiConfig } from './aiConfig';
export { ISSUE_KINDS };

const PRICE: Record<string, [number, number]> = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] };

export const Correction = z.object({
  corrected: z.string().describe('The learner text with the minimum edits needed to be correct French. Keep their ideas, words and sentence order.'),
  issues: z.array(z.object({
    original: z.string().describe('Exact substring copied from the learner text.'),
    correction: z.string().describe('What it should be.'),
    kind: z.enum(ISSUE_KINDS),
    explanation_vi: z.string().describe('Short explanation in Vietnamese, French terms in parentheses.'),
  })),
  strengths_vi: z.array(z.string()).describe('One to three concrete things done well, in Vietnamese.'),
  overall_vi: z.string().describe('Two or three sentences of overall feedback in Vietnamese.'),
  task_fit_vi: z.string().describe('Does the text answer the task (content points, length)? One sentence in Vietnamese.'),
  next_step_vi: z.string().describe('One concrete thing to practise next, in Vietnamese.'),
  better_version: z.string().describe('A natural A1-level rewrite (still simple), for comparison.'),
});
export type CorrectionT = z.infer<typeof Correction>;

export interface CorrectionResult { data: CorrectionT; model: string; inputTokens: number; outputTokens: number; costUsd: number }

const SYSTEM = `You are a patient French writing tutor for one adult learner. Their first language is Vietnamese and they read English at C1. They study with the textbook Édito A1 and are at CEFR A1.

How to correct:
- Correct only real mistakes. Do not "improve" style that is already correct, and do not push beyond A1 grammar in "corrected".
- "corrected" keeps the learner's own words, ideas and order with the fewest edits.
- List every edit in "issues", each with the exact original substring so it can be highlighted. Missing or wrong accents are kind "accent"; wrong letters are "spelling"; je/j', le/l', de/d' problems are "elision".
- Explanations are short, written in Vietnamese, with the French grammar term in parentheses, e.g. « Tính từ phải hợp giống với chủ ngữ giống cái (accord) ». Where it helps, point out the typical Vietnamese-speaker trap (no gender, no conjugation, no articles in Vietnamese).
- French typography: a space before ? ! : ; is expected but only mention it once, as kind "punctuation".
- "better_version" stays simple and A1, so the learner can copy its patterns.
- All feedback fields are in Vietnamese; French words stay in French.`;


async function client(key: string) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // Personal app on the learner's own device with their own key: browser use is intended here.
  return { Anthropic, c: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 }) };
}

/** Readable Vietnamese message for an API failure. */
export async function aiErrorVi(e: unknown): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  if (e instanceof Anthropic.AuthenticationError) return 'Khoá API không hợp lệ hoặc đã bị thu hồi. Kiểm tra lại trong Réglages.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'Khoá này không có quyền dùng mô hình đã chọn. Thử mô hình khác trong Réglages.';
  if (e instanceof Anthropic.NotFoundError) return 'Không tìm thấy mô hình. Chọn mô hình khác trong Réglages.';
  if (e instanceof Anthropic.RateLimitError) return 'Đang bị giới hạn tốc độ hoặc hết hạn mức. Thử lại sau ít phút.';
  if (e instanceof Anthropic.BadRequestError) return `Yêu cầu bị từ chối: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return 'Không kết nối được tới Anthropic. Kiểm tra mạng rồi thử lại.';
  if (e instanceof Anthropic.APIError) return `Lỗi từ máy chủ (${e.status ?? '?'}). Thử lại sau.`;
  return (e as Error)?.message ?? 'Lỗi không rõ.';
}

/** Cheap key check: reads the chosen model's metadata (no tokens billed). */
export async function testKey(key: string, model: string): Promise<string> {
  const { c } = await client(key);
  const m = await c.models.retrieve(model);
  return m.display_name;
}

export async function correctWriting(opts: { text: string; taskFr: string; taskVi?: string; unitTitle?: string; grammar?: string[]; targetWords?: [number, number] | null }): Promise<CorrectionResult> {
  const { key, model } = await getAiConfig();
  if (!key) throw new Error('Chưa có API key.');
  const { c } = await client(key);
  const { betaZodOutputFormat } = await import('@anthropic-ai/sdk/helpers/beta/zod');
  const ctx = [
    `Task (from the textbook): ${opts.taskFr}`,
    opts.taskVi ? `Task in Vietnamese: ${opts.taskVi}` : '',
    opts.targetWords ? `Target length: ${opts.targetWords[0]}–${opts.targetWords[1]} words.` : '',
    opts.unitTitle ? `Current unit: ${opts.unitTitle}.` : '',
    opts.grammar?.length ? `Grammar studied so far: ${opts.grammar.join('; ')}.` : '',
  ].filter(Boolean).join('\n');
  const res = await c.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: model === 'claude-haiku-5-5' ? undefined : 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(Correction) },
    system: SYSTEM,
    messages: [{ role: 'user', content: `${ctx}\n\nLearner text:\n<text>\n${opts.text}\n</text>` }],
  });
  if (res.stop_reason === 'refusal') throw new Error('Mô hình từ chối xử lý đoạn này. Thử sửa lại nội dung rồi gửi lại.');
  if (res.stop_reason === 'max_tokens') throw new Error('Câu trả lời bị cắt giữa chừng. Thử gửi đoạn ngắn hơn.');
  if (!res.parsed_output) throw new Error('Không đọc được kết quả sửa bài. Thử lại.');
  const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
  const outputTokens = res.usage.output_tokens;
  const [pi, po] = PRICE[res.model] ?? PRICE[model] ?? [4, 20];
  const costUsd = (inputTokens * pi + outputTokens * po) / 1e6;
  const prev = await getSetting<{ calls: number; usd: number }>('aiUsage', { calls: 0, usd: 0 });
  await setSetting('aiUsage', { calls: prev.calls + 1, usd: prev.usd + costUsd });
  return { data: res.parsed_output, model: res.model, inputTokens, outputTokens, costUsd };
}
