import { useCallback, useState } from 'react';
import { micPermission, micSupported, openMic } from '../../engine/recorder';
import { getSetting, setSetting } from '../../engine/db';
import { Sheet } from '../../ui/kit';

/**
 * Smooth mic permission flow: explain once, then ask the browser. The stream stays open
 * for the session so iOS does not prompt again.
 */
export function useMic() {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(null);

  const ensure = useCallback(async (): Promise<boolean> => {
    if (!micSupported()) { setError('Trình duyệt này không hỗ trợ ghi âm.'); return false; }
    const state = await micPermission();
    if (state === 'granted') { try { await openMic(); return true; } catch { /* fall through */ } }
    const explained = await getSetting('micExplained', false);
    if (!explained || state === 'denied') {
      return new Promise<boolean>((res) => { setAsking(true); setResolver(() => res); });
    }
    try { await openMic(); return true; } catch (e) { setError(msg(e)); return false; }
  }, []);

  const allow = async () => {
    await setSetting('micExplained', true);
    try { await openMic(); setAsking(false); resolver?.(true); }
    catch (e) { setError(msg(e)); resolver?.(false); setAsking(false); }
  };

  const sheet = (
    <Sheet open={asking} onClose={() => { setAsking(false); resolver?.(false); }} title="Cho phép dùng micro">
      <p className="t-gloss text-[24px] leading-snug">Votre voix, à côté de la leur.</p>
      <p className="t-body measure mt-4">Để so sánh giọng bạn với bản gốc, app cần ghi âm. Bản ghi <b>chỉ lưu trong máy</b> và không gửi đi đâu.</p>
      <p className="t-small measure mt-4 text-ink2">Trên iPhone: bấm « Cho phép » ở hộp thoại tiếp theo. Nếu lỡ bấm « Không cho phép », vào Cài đặt → Safari → Micro để bật lại.</p>
      <p className="t-small measure mt-3 text-ink2">Mẹo: đeo tai nghe khi shadowing để micro không thu lại tiếng loa.</p>
      <button className="btn btn-primary mb-6 mt-8 w-full" onClick={allow}>Tiếp tục</button>
    </Sheet>
  );
  return { ensure, sheet, error, clearError: () => setError(null) };
}

function msg(e: unknown) {
  const name = (e as DOMException)?.name;
  if (name === 'NotAllowedError') return 'Micro bị chặn. Trên iPhone: Cài đặt → Safari → Micro → Cho phép.';
  if (name === 'NotFoundError') return 'Không tìm thấy micro.';
  return 'Không mở được micro.';
}
