/**
 * Built-in French phonetics lessons for Vietnamese speakers (written for this app — not textbook content).
 * Book audio is used where a unit pack provides it (bookAudio refs); otherwise TTS, always labelled.
 */
import type { AudioRef } from '../engine/types';

export interface LabPair { a: string; b: string; ipaA: string; ipaB: string; viA?: string; viB?: string; audioA?: AudioRef; audioB?: AudioRef }
export interface LabLesson {
  id: string;
  title: string;
  ipa: string[];
  oneLiner: string;
  explanationVi: string;
  articulation: string[];
  vnGood?: string;
  vnWarn?: string;
  pairs: LabPair[];
  sayWords: { fr: string; ipa: string; vi?: string }[];
  linkSpeller?: boolean;
  focusPitch?: boolean;
}

export const LAB: LabLesson[] = [
  {
    id: 'e-ferme-ouvert', title: 'é /e/ hay è, ê /ɛ/', ipa: ['e', 'ɛ'],
    oneLiner: 'é = « ê » tiếng Việt · è/ê = « e » tiếng Việt',
    explanationVi: 'Đây là cặp âm bạn hay đảo ngược vì chính tả tiếng Việt. Trong tiếng Pháp, dấu trên chữ cái KHÔNG phải thanh điệu mà cho biết độ mở của miệng:\n• é (accent aigu) = /e/: miệng khép, giống « ê » trong « bê, lê ».\n• è (accent grave) và ê (accent circonflexe) = /ɛ/: miệng mở hơn, giống « e » trong « be, le ».\nNhững cách viết khác: -er, -ez cuối từ (parler, parlez) và « et » đọc /e/; « ai », « ei », « et » giữa từ thường đọc /ɛ/ (lait, neige).',
    articulation: [
      '/e/ (é): hai mép miệng kéo ngang nhẹ như cười, hàm gần khép, lưỡi cao, chạm sau răng cửa dưới. Nói « ê » và GIỮ NGUYÊN, không trượt sang « ây ».',
      '/ɛ/ (è, ê): hạ hàm xuống thêm khoảng một ngón tay, lưỡi thấp hơn — đúng như « e » tiếng Việt.',
      'Cả hai đều là nguyên âm « thuần »: không có bán âm ở cuối như tiếng Anh « day ».',
      'Đọc ngang giọng: é không lên giọng như dấu sắc, è không xuống giọng như dấu huyền.',
    ],
    vnGood: 'é ≈ « ê » (bê), è/ê ≈ « e » (be). Ánh xạ này chính xác — hãy thuộc lòng nó.',
    vnWarn: 'Bẫy: thấy dấu sắc (é) trong đầu bạn tự đọc « e » có thanh sắc. Sai hai lần: sai nguyên âm (phải là ê) và thêm thanh điệu (phải ngang).',
    pairs: [
      { a: 'des', b: 'dès', ipaA: 'de', ipaB: 'dɛ', viA: 'những (mạo từ)', viB: 'ngay từ' },
      { a: 'thé', b: 'tête', ipaA: 'te', ipaB: 'tɛt', viA: 'trà', viB: 'đầu' },
      { a: 'fée', b: 'fait', ipaA: 'fe', ipaB: 'fɛ', viA: 'bà tiên', viB: 'sự việc' },
      { a: 'été', b: 'êtes', ipaA: 'e.te', ipaB: 'ɛt', viA: 'mùa hè', viB: '(vous) êtes' },
      { a: 'les', b: 'lait', ipaA: 'le', ipaB: 'lɛ', viA: 'các (mạo từ)', viB: 'sữa' },
      { a: 'mes', b: 'mais', ipaA: 'me', ipaB: 'mɛ', viA: 'của tôi (số nhiều)', viB: 'nhưng' },
    ],
    sayWords: [
      { fr: 'café', ipa: 'ka.fe' }, { fr: 'été', ipa: 'e.te' }, { fr: 'père', ipa: 'pɛʁ' }, { fr: 'fête', ipa: 'fɛt' },
      { fr: 'Sénégal', ipa: 'se.ne.ɡal' }, { fr: 'élève', ipa: 'e.lɛv' }, { fr: 'vous êtes', ipa: 'vu.z‿ɛt' }, { fr: 'très bien', ipa: 'tʁɛ bjɛ̃' },
    ],
    focusPitch: true,
  },
  {
    id: 'pas-de-ton', title: 'Không có thanh điệu', ipa: [],
    oneLiner: 'Dấu trên chữ ≠ dấu thanh. Giữ giọng ngang, chỉ nhấn cuối nhóm.',
    explanationVi: 'Tiếng Việt có 6 thanh: đổi cao độ là đổi nghĩa (ma, má, mà…). Tiếng Pháp KHÔNG có thanh từ vựng. Cao độ chỉ thay đổi ở cấp CÂU: cuối mỗi nhóm nhịp hơi lên (câu chưa hết), cuối câu khẳng định đi xuống, cuối câu hỏi có/không đi lên.\nThói quen của người Việt: gặp é thì lên giọng (như dấu sắc), gặp è thì hạ giọng (như dấu huyền), và mỗi âm tiết có một « nét » cao độ riêng → người Pháp nghe như « hát » hoặc « giật cục ».',
    articulation: [
      'Đọc một từ như « été », « élève », « préféré » với giọng ĐỀU như máy, mọi âm tiết cùng cao độ.',
      'Kéo dài âm tiết cuối một chút (đó là trọng âm tiếng Pháp), không đổi cao độ ở các âm tiết trước.',
      'Xem biểu đồ: đường của bạn nên gần như PHẲNG trên mỗi từ. Nếu thấy hình răng cưa (lên–xuống trên từng âm tiết), đó là thanh điệu tiếng Việt đang « lọt » vào.',
      'Luyện thêm ở Studio: phần Phonétique của Unité 1 (« Les groupes rythmiques et l\'accent tonique »).',
    ],
    vnWarn: 'Đừng « dịch » dấu: é không phải dấu sắc, è không phải dấu huyền, ê không phải dấu mũ của « ê »… mà ê trong tiếng Pháp đọc là « e »!',
    pairs: [],
    sayWords: [
      { fr: 'été', ipa: 'e.te' }, { fr: 'élève', ipa: 'e.lɛv' }, { fr: 'préféré', ipa: 'pʁe.fe.ʁe' }, { fr: 'déjà', ipa: 'de.ʒa' },
      { fr: 'frère', ipa: 'fʁɛʁ' }, { fr: 'très', ipa: 'tʁɛ' }, { fr: 'Je m\'appelle Thảo.', ipa: 'ʒə ma.pɛl ta.o' }, { fr: 'Je suis vietnamienne.', ipa: 'ʒə sɥi vjɛt.na.mjɛn' },
    ],
    focusPitch: true,
  },
  {
    id: 'b-p', title: '/b/ hay /p/', ipa: ['b', 'p'],
    oneLiner: 'p tiếng Pháp: không rung dây thanh, không bật hơi.',
    explanationVi: 'Người Việt hay đọc cả b và p thành /b/ (có rung dây thanh), vì « p » đầu từ gần như không có trong tiếng Việt. Trong tiếng Pháp:\n• /b/: dây thanh rung NGAY từ đầu — giống « b » tiếng Việt (« ba »).\n• /p/: dây thanh KHÔNG rung khi hai môi bật ra, và cũng KHÔNG bật hơi mạnh như « p » tiếng Anh (« pen »). Nó gần với « p » cuối âm tiết của tiếng Việt (« đẹp ») nhưng được bật ra.',
    articulation: [
      'Đặt mu bàn tay trước miệng: nói « pa » — gần như không có luồng hơi (khác tiếng Anh).',
      'Đặt ngón tay lên cổ họng: nói « ba » — cảm thấy rung ngay. Nói « pa » — chỉ rung khi đến nguyên âm a.',
      'Mẹo: nghĩ đến « b » nhưng « thì thầm » phần đầu: môi khép, giữ yên dây thanh, bật môi rồi mới cho giọng vào nguyên âm.',
    ],
    vnGood: '/b/ Pháp = « b » tiếng Việt.',
    vnWarn: '/p/ không có tương đương đầu từ trong tiếng Việt: đừng thay bằng « b », cũng đừng bật hơi kiểu tiếng Anh.',
    pairs: [
      { a: 'bain', b: 'pain', ipaA: 'bɛ̃', ipaB: 'pɛ̃', viA: 'bồn tắm', viB: 'bánh mì' },
      { a: 'boire', b: 'poire', ipaA: 'bwaʁ', ipaB: 'pwaʁ', viA: 'uống', viB: 'quả lê' },
      { a: 'bas', b: 'pas', ipaA: 'ba', ipaB: 'pa', viA: 'thấp', viB: 'bước; không' },
      { a: 'beau', b: 'peau', ipaA: 'bo', ipaB: 'po', viA: 'đẹp', viB: 'da' },
      { a: 'bière', b: 'pierre', ipaA: 'bjɛʁ', ipaB: 'pjɛʁ', viA: 'bia', viB: 'đá' },
      { a: 'bon', b: 'pont', ipaA: 'bɔ̃', ipaB: 'pɔ̃', viA: 'tốt', viB: 'cây cầu' },
    ],
    sayWords: [
      { fr: 'Paris', ipa: 'pa.ʁi' }, { fr: 'Pologne', ipa: 'pɔ.lɔɲ' }, { fr: 'portable', ipa: 'pɔʁ.tabl' }, { fr: 'Belgique', ipa: 'bɛl.ʒik' },
      { fr: 'le pain', ipa: 'lə pɛ̃' }, { fr: 'bonjour', ipa: 'bɔ̃.ʒuʁ' }, { fr: 'la peinture', ipa: 'la pɛ̃.tyʁ' }, { fr: 'Brésil', ipa: 'bʁe.zil' },
    ],
  },
  {
    id: 'lettres-gj', title: 'Tên chữ G /ʒe/ và J /ʒi/', ipa: ['ʒe', 'ʒi'],
    oneLiner: 'Ngược với tiếng Anh: G = « gé », J = « ji ».',
    explanationVi: 'Khi đánh vần (tên, email — Unité 0 và 1), hai chữ này gây nhầm nhiều nhất vì ngược với tiếng Anh: tiếng Anh G = « dji », J = « djei »; tiếng Pháp G = /ʒe/ (« gê » với âm /ʒ/), J = /ʒi/ (« gi »). Tương tự E = /ø/ (« ơ » tròn môi) và I = /i/.',
    articulation: [
      '/ʒ/ là âm xát hữu thanh: bắt đầu từ « gi » (giọng Bắc, /z/), lùi lưỡi về sau một chút và chu môi ra — âm sẽ « dày » hơn, như tiếng « s » trong « pleasure » của tiếng Anh. Không có tiếng « đ » ở đầu như tiếng Anh « j ».',
      'G = /ʒ/ + /e/ (« ê »). J = /ʒ/ + /i/.',
      'Mẹo nhớ: G-É (gé) có é như « général »; J-I (ji) như « Jimmy » nhưng không có « đ ».',
    ],
    vnWarn: 'Đừng đọc G là « gờ » (cách gọi chữ trong tiếng Việt) và đừng mang cách đọc tiếng Anh sang.',
    pairs: [
      { a: 'G', b: 'J', ipaA: 'ʒe', ipaB: 'ʒi', audioA: { trackId: 't004', segIdx: 6 }, audioB: { trackId: 't004', segIdx: 9 } },
      { a: 'E', b: 'I', ipaA: 'ø', ipaB: 'i', audioA: { trackId: 't004', segIdx: 4 }, audioB: { trackId: 't004', segIdx: 8 } },
      { a: 'U', b: 'Q', ipaA: 'y', ipaB: 'ky', audioA: { trackId: 't004', segIdx: 20 }, audioB: { trackId: 't004', segIdx: 16 } },
      { a: 'B', b: 'P', ipaA: 'be', ipaB: 'pe', audioA: { trackId: 't004', segIdx: 1 }, audioB: { trackId: 't004', segIdx: 15 } },
    ],
    sayWords: [{ fr: 'G', ipa: 'ʒe' }, { fr: 'J', ipa: 'ʒi' }, { fr: 'E', ipa: 'ø' }, { fr: 'I', ipa: 'i' }, { fr: 'R', ipa: 'ɛʁ' }, { fr: 'H', ipa: 'aʃ' }],
    linkSpeller: true,
  },
  {
    id: 'u-ou', title: 'u /y/ hay ou /u/', ipa: ['y', 'u'],
    oneLiner: 'u = lưỡi như « i », môi như « u ».',
    explanationVi: 'Âm /y/ (chữ u) không có trong tiếng Việt. Người Việt thường đọc nó thành « u » (/u/ — là chữ « ou » của tiếng Pháp) hoặc « uy ». Hai âm này phân biệt nghĩa: tu (bạn) ≠ tout (tất cả), vu (đã thấy) ≠ vous (các bạn).',
    articulation: [
      'Nói « i » và giữ lưỡi nguyên chỗ (đầu lưỡi chạm răng cửa dưới).',
      'Bây giờ chu tròn môi thật nhỏ như khi huýt sáo hoặc nói « u » — KHÔNG di chuyển lưỡi. Âm phát ra là /y/.',
      '/u/ (ou) thì lưỡi rút về sau như « u » tiếng Việt. Gần đúng hoàn toàn với « u ».',
      'Kiểm tra trong gương: /y/ và /u/ có dáng môi giống nhau — khác nhau hoàn toàn nằm ở lưỡi.',
    ],
    vnGood: 'ou /u/ = « u » tiếng Việt (« thu »).',
    vnWarn: 'u /y/ ≠ « u », ≠ « uy », ≠ « iu ». Không có âm Việt nào tương đương.',
    pairs: [
      { a: 'tu', b: 'tout', ipaA: 'ty', ipaB: 'tu', viA: 'bạn (tu)', viB: 'tất cả' },
      { a: 'vu', b: 'vous', ipaA: 'vy', ipaB: 'vu', viA: 'đã thấy', viB: 'các bạn' },
      { a: 'rue', b: 'roue', ipaA: 'ʁy', ipaB: 'ʁu', viA: 'con phố', viB: 'bánh xe' },
      { a: 'dessus', b: 'dessous', ipaA: 'də.sy', ipaB: 'də.su', viA: 'phía trên', viB: 'phía dưới' },
      { a: 'lu', b: 'loup', ipaA: 'ly', ipaB: 'lu', viA: 'đã đọc', viB: 'con sói' },
      { a: 'pur', b: 'pour', ipaA: 'pyʁ', ipaB: 'puʁ', viA: 'tinh khiết', viB: 'cho, để' },
    ],
    sayWords: [{ fr: 'Tu vas bien ?', ipa: 'ty va bjɛ̃' }, { fr: 'musique', ipa: 'my.zik' }, { fr: 'Russie', ipa: 'ʁy.si' }, { fr: 'bonjour', ipa: 'bɔ̃.ʒuʁ' }, { fr: 'vous', ipa: 'vu' }, { fr: 'salut', ipa: 'sa.ly' }],
  },
  {
    id: 'nasales', title: 'Nguyên âm mũi: on, an/en, in/un', ipa: ['ɔ̃', 'ɑ̃', 'ɛ̃'],
    oneLiner: 'Không có « ng » ở cuối: hơi đi qua mũi, lưỡi không chạm vòm.',
    explanationVi: 'Tiếng Pháp có 3 nguyên âm mũi chính (un /œ̃/ ngày nay thường đọc như in /ɛ̃/):\n• on, om → /ɔ̃/ (bon, nom)\n• an, am, en, em → /ɑ̃/ (France, temps, enfant)\n• in, im, ain, ein, un → /ɛ̃/ (vin, pain, un)\nNgười Việt hay thêm phụ âm « ng » hoặc « n » ở cuối (« bông », « phăng ») — sai, vì trong tiếng Pháp lưỡi KHÔNG chạm vòm miệng, chỉ có hơi thoát qua mũi.',
    articulation: [
      '/ɔ̃/ (on): môi tròn như « ô », hạ vòm mềm cho hơi qua mũi. Gần « ông » nhưng dừng trước khi lưỡi chạm « ng ».',
      '/ɑ̃/ (an): miệng mở rộng như « a » sâu trong họng, môi hơi tròn, qua mũi. Gần « ăng » không có « ng ».',
      '/ɛ̃/ (in): miệng mở như « e », môi kéo ngang, qua mũi. Gần « eng » không có « ng ».',
      'Kiểm tra: bịt mũi lại khi nói — nếu âm thay đổi rõ, bạn đang dùng mũi đúng cách.',
      'Nếu sau n/m là nguyên âm thì KHÔNG còn âm mũi: bon /bɔ̃/ nhưng bonne /bɔn/; fin /fɛ̃/ nhưng fine /fin/.',
    ],
    vnGood: 'Hình dáng miệng gần ô / a / e của tiếng Việt.',
    vnWarn: 'Không đóng âm bằng « ng » hay « n ». « Bon » không phải « bông », « France » không phải « phrăng-xơ ».',
    pairs: [
      { a: 'bon', b: 'banc', ipaA: 'bɔ̃', ipaB: 'bɑ̃', viA: 'tốt', viB: 'ghế băng' },
      { a: 'long', b: 'lent', ipaA: 'lɔ̃', ipaB: 'lɑ̃', viA: 'dài', viB: 'chậm' },
      { a: 'vent', b: 'vin', ipaA: 'vɑ̃', ipaB: 'vɛ̃', viA: 'gió', viB: 'rượu vang' },
      { a: 'sans', b: 'sain', ipaA: 'sɑ̃', ipaB: 'sɛ̃', viA: 'không có', viB: 'lành mạnh' },
      { a: 'pont', b: 'pain', ipaA: 'pɔ̃', ipaB: 'pɛ̃', viA: 'cây cầu', viB: 'bánh mì' },
      { a: 'bon', b: 'bonne', ipaA: 'bɔ̃', ipaB: 'bɔn', viA: 'tốt (giống đực)', viB: 'tốt (giống cái)' },
      { a: 'fin', b: 'fine', ipaA: 'fɛ̃', ipaB: 'fin', viA: 'kết thúc', viB: 'mảnh (giống cái)' },
    ],
    sayWords: [{ fr: 'France', ipa: 'fʁɑ̃s' }, { fr: 'bonjour', ipa: 'bɔ̃.ʒuʁ' }, { fr: 'italien', ipa: 'i.ta.ljɛ̃' }, { fr: 'italienne', ipa: 'i.ta.ljɛn' }, { fr: 'enfant', ipa: 'ɑ̃.fɑ̃' }, { fr: 'vingt-cinq', ipa: 'vɛ̃t.sɛ̃k' }],
  },
  {
    id: 'oi', title: 'oi = /wa/', ipa: ['wa'],
    oneLiner: 'moi = « moa », không phải « mô-i ».',
    explanationVi: 'Tổ hợp chữ « oi » luôn đọc /wa/ (như « oa » trong « hoa »). Người mới học hay đọc theo chữ thành « ôi ». Cũng vậy với « oy » (voyage /vwa.jaʒ/).',
    articulation: ['Bắt đầu với môi tròn như « u » rất ngắn, rồi mở ngay ra « a »: /w/ + /a/.', 'Đọc thành một âm tiết: trois = « troa », một nhịp.'],
    vnGood: 'oi ≈ « oa » trong « hoa ». Ánh xạ chính xác.',
    vnWarn: 'Không đọc « ôi » như tiếng Việt.',
    pairs: [
      { a: 'toi', b: 'tôt', ipaA: 'twa', ipaB: 'to', viA: 'bạn (nhấn mạnh)', viB: 'sớm' },
      { a: 'moi', b: 'mot', ipaA: 'mwa', ipaB: 'mo', viA: 'tôi (nhấn mạnh)', viB: 'từ' },
      { a: 'loi', b: 'lot', ipaA: 'lwa', ipaB: 'lo', viA: 'luật', viB: 'lô' },
    ],
    sayWords: [{ fr: 'moi', ipa: 'mwa' }, { fr: 'trois', ipa: 'tʁwa' }, { fr: 'bonsoir', ipa: 'bɔ̃.swaʁ' }, { fr: 'au revoir', ipa: 'o ʁə.vwaʁ' }, { fr: 'voici', ipa: 'vwa.si' }, { fr: 'suédois', ipa: 'sɥe.dwa' }],
  },
  {
    id: 'muettes', title: 'Phụ âm cuối câm và e câm', ipa: [],
    oneLiner: 'Phần lớn phụ âm cuối không đọc — trừ C, R, F, L.',
    explanationVi: 'Trong tiếng Pháp, phụ âm cuối từ thường KHÔNG đọc: petit /pə.ti/, grand /ɡʁɑ̃/, Paris /pa.ʁi/, vous /vu/, ils parlent /il paʁl/ (-ent của động từ câm). Ngoại lệ thường gặp: c, r, f, l cuối từ thường được đọc (mẹo « CaReFuL »): parc, mer, neuf, sel — nhưng -er của động từ (parler) đọc /e/.\nChữ e cuối từ cũng câm, nhưng nó làm phụ âm đứng trước được đọc lên: petit /pə.ti/ → petite /pə.tit/, français → française. Đây chính là cách phân biệt giống đực/cái khi nghe.',
    articulation: ['Dừng ở nguyên âm: « Pa-ri », không phải « Pa-rít ».', 'Với giống cái: phụ âm trước e được đọc rõ nhưng KHÔNG thêm nguyên âm « ơ » sau nó: française = /fʁɑ̃.sɛz/, không phải « phrăng-xe-dơ ».'],
    vnWarn: 'Người Việt hay thêm « ơ » sau phụ âm cuối (« Bê-lờ-gích », « phrăng-xơ »). Phụ âm cuối Pháp kết thúc gọn, không có nguyên âm thêm.',
    pairs: [
      { a: 'petit', b: 'petite', ipaA: 'pə.ti', ipaB: 'pə.tit', viA: 'nhỏ (đực)', viB: 'nhỏ (cái)' },
      { a: 'grand', b: 'grande', ipaA: 'ɡʁɑ̃', ipaB: 'ɡʁɑ̃d', viA: 'lớn (đực)', viB: 'lớn (cái)' },
      { a: 'français', b: 'française', ipaA: 'fʁɑ̃.sɛ', ipaB: 'fʁɑ̃.sɛz', audioA: undefined },
      { a: 'allemand', b: 'allemande', ipaA: 'al.mɑ̃', ipaB: 'al.mɑ̃d' },
    ],
    sayWords: [{ fr: 'Paris', ipa: 'pa.ʁi' }, { fr: 'ils parlent', ipa: 'il paʁl' }, { fr: 'française', ipa: 'fʁɑ̃.sɛz' }, { fr: 'Belgique', ipa: 'bɛl.ʒik' }, { fr: 'neuf', ipa: 'nœf' }, { fr: 'beaucoup', ipa: 'bo.ku' }],
  },
  {
    id: 'liaison', title: 'Nối âm (liaison) và enchaînement', ipa: ['z‿', 't‿', 'n‿'],
    oneLiner: 'Phụ âm câm « sống lại » trước nguyên âm.',
    explanationVi: 'LIAISON: một phụ âm cuối vốn câm được đọc lên và nối sang từ sau nếu từ sau bắt đầu bằng nguyên âm: les amis /le.z‿a.mi/, vous êtes /vu.z‿ɛt/, ils ont /il.z‿ɔ̃/. Chữ s, x đọc thành /z/.\nENCHAÎNEMENT: phụ âm cuối vốn đã đọc được kéo sang nguyên âm sau: il a /i.la/, elle est /ɛ.lɛ/, Je m\'appelle Arthur /ma.pɛ.laʁ.tyʁ/.\nCặp quan trọng nhất ở A1: ils ont /il.z‿ɔ̃/ (họ có) ≠ ils sont /il.sɔ̃/ (họ là).',
    articulation: ['Đọc hai từ như một từ: « lé-za-mi », không ngắt.', '/z/ là « d » của tiếng Việt miền Bắc phát âm như « z » (rung), không phải « s ».'],
    vnWarn: 'Người Việt hay ngắt giữa các từ (« vu — ết »). Hãy nối liền: « vu-zết ».',
    pairs: [
      { a: 'ils ont', b: 'ils sont', ipaA: 'il.z‿ɔ̃', ipaB: 'il.sɔ̃', viA: 'họ có', viB: 'họ là' },
      { a: 'elles ont', b: 'elles sont', ipaA: 'ɛl.z‿ɔ̃', ipaB: 'ɛl.sɔ̃', viA: 'họ (nữ) có', viB: 'họ (nữ) là' },
      { a: 'nous avons', b: 'nous savons', ipaA: 'nu.z‿a.vɔ̃', ipaB: 'nu.sa.vɔ̃', viA: 'chúng tôi có', viB: 'chúng tôi biết' },
      { a: 'ils aiment', b: 'ils sèment', ipaA: 'il.z‿ɛm', ipaB: 'il.sɛm', viA: 'họ thích', viB: 'họ gieo hạt' },
    ],
    sayWords: [{ fr: 'les enfants', ipa: 'le.z‿ɑ̃.fɑ̃' }, { fr: 'vous êtes', ipa: 'vu.z‿ɛt' }, { fr: 'vous avez', ipa: 'vu.z‿a.ve' }, { fr: 'il a huit ans', ipa: 'i.la ɥi.t‿ɑ̃' }, { fr: 'les États-Unis', ipa: 'le.z‿e.ta.z‿y.ni' }, { fr: 'joyeux anniversaire', ipa: 'ʒwa.jø.z‿a.ni.vɛʁ.sɛʁ' }],
  },
];

/** Accent names for the spelling trainer. */
export const ACCENTS = [
  { char: 'é', name: 'e accent aigu', vi: 'dấu sắc Pháp — đọc « ê »' },
  { char: 'è', name: 'e accent grave', vi: 'dấu huyền Pháp — đọc « e »' },
  { char: 'ê', name: 'e accent circonflexe', vi: 'dấu mũ — đọc « e »' },
  { char: 'à', name: 'a accent grave', vi: '' },
  { char: 'ç', name: 'c cédille', vi: 'đọc /s/' },
  { char: 'ë', name: 'e tréma', vi: 'đọc tách riêng' },
  { char: 'ô', name: 'o accent circonflexe', vi: '' },
  { char: 'ù', name: 'u accent grave', vi: '' },
];

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const TRICKY = ['G', 'J', 'E', 'I', 'U', 'Q', 'R', 'H', 'W', 'Y', 'B', 'P'];
