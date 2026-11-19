/** The 7-step shadowing ladder. Each step is a distinct mode, unlocked in order. */
export interface StepDef {
  n: number;
  short: string;
  title: string;
  howVi: string;
  text: 'hidden' | 'visible';
  play: 'continuous' | 'echo';
  needs: number;          // full passes needed to complete
  record?: 'take';
}

export const STEPS: StepDef[] = [
  { n: 1, short: 'Nghe mù', title: 'Nghe không nhìn chữ', howVi: 'Nhắm mắt, nghe cả đoạn 2–3 lần. Chỉ cần bắt nhịp điệu và giai điệu, chưa cần hiểu hết.', text: 'hidden', play: 'continuous', needs: 2 },
  { n: 2, short: 'Nghe có chữ', title: 'Nghe và đọc', howVi: 'Nghe và dõi theo chữ. Bật bản dịch tiếng Việt nếu cần, rồi tắt đi ở lượt sau.', text: 'visible', play: 'continuous', needs: 1 },
  { n: 3, short: 'Nhại từng câu', title: 'Echo — nghe rồi nhắc lại', howVi: 'Mỗi câu phát xong, app dừng 1,5 lần độ dài câu để bạn nhắc lại. Bật « Ghi » để lưu giọng mình.', text: 'visible', play: 'echo', needs: 1 },
  { n: 4, short: 'Lẩm nhẩm theo', title: 'Mumble shadowing', howVi: 'Nói lẩm nhẩm CÙNG LÚC với audio, nhìn chữ. Chưa cần rõ từng âm — chỉ bám theo nhịp và ngữ điệu.', text: 'visible', play: 'continuous', needs: 1 },
  { n: 5, short: 'Nhại có chữ', title: 'Shadowing đầy đủ, có chữ', howVi: 'Nói to, rõ, cùng lúc với audio. Đeo tai nghe để không nghe lẫn giọng mình với loa.', text: 'visible', play: 'continuous', needs: 1 },
  { n: 6, short: 'Nhại không chữ', title: 'Shadowing không nhìn chữ', howVi: 'Như bước 5 nhưng giấu chữ. Nếu bị mất dấu, giảm tốc độ xuống 0.85× hoặc 0.75×.', text: 'hidden', play: 'continuous', needs: 1 },
  { n: 7, short: 'Ghi một lượt', title: 'Ghi âm cả đoạn', howVi: 'Ghi giọng bạn nhại cả đoạn từ đầu đến cuối. Bản ghi được lưu theo ngày để so sánh sự tiến bộ.', text: 'visible', play: 'continuous', needs: 1, record: 'take' },
];
