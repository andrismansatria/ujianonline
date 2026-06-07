// Bank soal UTS - ubah/tambah soal di sini
export const SOAL = [
  // === KONSEP DASAR & KESTATISAN (6 soal) ===
  {
    id: 'q1', topik: 'Konsep', bobot: 5, tipe: 'mc',
    pertanyaan: 'Manakah yang BUKAN asumsi dasar rangka batang ideal?',
    opsi: [
      { val: 'A', text: 'Sambungan antar batang dianggap sebagai sendi sempurna' },
      { val: 'B', text: 'Beban hanya bekerja pada titik buhul' },
      { val: 'C', text: 'Batang menerima gaya aksial dan momen lentur bersamaan' },
      { val: 'D', text: 'Sumbu batang berimpit dengan garis hubung dua titik buhulnya' }
    ],
    benar: 'C',
    pembahasan: 'Pada rangka ideal, setiap batang HANYA menerima gaya aksial (tarik/tekan). Tidak ada momen lentur karena sambungan diasumsikan sendi sempurna.'
  },
  {
    id: 'q2', topik: 'Konsep', bobot: 8, tipe: 'mc',
    pertanyaan: 'Rangka bidang dengan b=13, r=3, j=8. Termasuk struktur apa?',
    figure: 'Rumus: b + r ? 2j',
    opsi: [
      { val: 'A', text: 'Statis tak tentu (indeterminate)' },
      { val: 'B', text: 'Statis tertentu (determinate)' },
      { val: 'C', text: 'Labil / mekanisme (unstable)' },
      { val: 'D', text: 'Tidak dapat ditentukan tanpa gambar' }
    ],
    benar: 'B',
    pembahasan: 'b + r = 13+3 = 16 ; 2j = 2×8 = 16. Karena b+r = 2j dan susunan stabil → statis tertentu.'
  },
  {
    id: 'q3', topik: 'Konsep', bobot: 8, tipe: 'mc',
    pertanyaan: 'Rangka bidang dengan b=10, r=3, j=7. Termasuk struktur apa?',
    opsi: [
      { val: 'A', text: 'Statis tertentu' },
      { val: 'B', text: 'Statis tak tentu derajat 1' },
      { val: 'C', text: 'Labil/mekanisme dengan 1 derajat kebebasan' },
      { val: 'D', text: 'Statis tak tentu derajat 2' }
    ],
    benar: 'C',
    pembahasan: 'b + r = 10+3 = 13 ; 2j = 14. Karena b+r < 2j → kurang batang → LABIL (mekanisme).'
  },
  {
    id: 'q4', topik: 'Konsep', bobot: 8, tipe: 'mc',
    pertanyaan: 'Rangka bidang dengan b=15, r=3, j=8. Derajat ketidaktentuan statis = ?',
    opsi: [
      { val: 'A', text: '0 (statis tertentu)' },
      { val: 'B', text: '1' },
      { val: 'C', text: '2' },
      { val: 'D', text: '3' }
    ],
    benar: 'C',
    pembahasan: 'b + r = 15+3 = 18 ; 2j = 16. Derajat tak tentu = 18−16 = 2.'
  },
  {
    id: 'q5', topik: 'Konsep', bobot: 5, tipe: 'mc',
    pertanyaan: 'Batang nol (zero-force member) umumnya terjadi pada:',
    opsi: [
      { val: 'A', text: 'Titik buhul dengan 2 batang tidak segaris dan tanpa beban luar' },
      { val: 'B', text: 'Titik buhul yang memikul beban terbesar' },
      { val: 'C', text: 'Batang tepi atas (top chord)' },
      { val: 'D', text: 'Batang yang paling panjang' }
    ],
    benar: 'A',
    pembahasan: 'Jika di sebuah titik buhul hanya bertemu 2 batang tidak segaris dan tanpa beban luar, ΣFx=ΣFy=0 → keduanya bergaya nol.'
  },
  {
    id: 'q6', topik: 'Konsep', bobot: 6, tipe: 'mc',
    pertanyaan: 'Pernyataan tentang batang nol yang BENAR:',
    opsi: [
      { val: 'A', text: 'Batang nol tidak perlu dipasang dalam struktur' },
      { val: 'B', text: 'Batang nol tetap dibutuhkan untuk stabilitas dan mengubah panjang tekuk' },
      { val: 'C', text: 'Batang nol mengalami momen lentur tetapi tidak gaya aksial' },
      { val: 'D', text: 'Batang nol hanya muncul pada rangka statis tak tentu' }
    ],
    benar: 'B',
    pembahasan: 'Batang nol tidak menerima gaya pada beban yang dianalisis, tapi tetap dibutuhkan untuk: (1) stabilitas geometris, (2) memperpendek panjang tekuk, (3) menahan beban pada konfigurasi pembebanan lain.'
  },

  // === METODE TITIK BUHUL (7 soal) ===
  {
    id: 'q7', topik: 'Titik Buhul', bobot: 8, tipe: 'dual',
    pertanyaan: 'Rangka segitiga: AB=8m, tinggi C=3m di tengah, beban P=20kN ↓ di C. A=sendi, B=rol. Hitung V_A.',
    figure: '       C  ↓ P=20 kN\n      /\\\n     /  \\  AC=BC=5m\n    /____\\\n   A  8m  B',
    inputs: [
      { id: 'nilai', label: 'V_A =', satuan: 'kN', benar: 10, tol: 0.1, poin: 8 }
    ],
    pembahasan: 'Simetris. ΣM_A=0: V_B×8 = 20×4 → V_B = 10 kN. V_A = 20−10 = 10 kN.'
  },
  {
    id: 'q8', topik: 'Titik Buhul', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Lanjutan: hitung |S_AC| dan jenis gayanya (keseimbangan titik A).',
    figure: 'sin θ = 3/5 = 0,60 ; cos θ = 4/5 = 0,80',
    inputs: [
      { id: 'nilai', label: '|S_AC| =', satuan: 'kN', benar: 16.67, tol: 0.15, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tekan', poin: 5 }
    ],
    pembahasan: 'ΣFy di A: 10 + S_AC×0,60 = 0 → S_AC = −16,67 kN → TEKAN.'
  },
  {
    id: 'q9', topik: 'Titik Buhul', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Lanjutan: hitung |S_AB| (chord bawah) dan jenisnya.',
    inputs: [
      { id: 'nilai', label: '|S_AB| =', satuan: 'kN', benar: 13.33, tol: 0.15, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tarik', poin: 5 }
    ],
    pembahasan: 'ΣFx di A: (−16,67)(0,80) + S_AB = 0 → S_AB = +13,33 kN → TARIK.'
  },
  {
    id: 'q10', topik: 'Titik Buhul', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Rangka simetris K: bentang 6m, tinggi 4m, P=30kN di puncak. Hitung gaya batang diagonal dari tumpuan ke puncak.',
    figure: 'Jarak horizontal puncak ke tumpuan = 3m, tinggi 4m → diagonal = 5m\nsin θ = 4/5 = 0,80 ; cos θ = 3/5 = 0,60',
    inputs: [
      { id: 'nilai', label: '|S_diagonal| =', satuan: 'kN', benar: 18.75, tol: 0.2, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tekan', poin: 5 }
    ],
    pembahasan: 'V_A = V_B = 15 kN. Di A: ΣFy = 15 + S×0,80 = 0 → S = −18,75 kN → TEKAN.'
  },
  {
    id: 'q11', topik: 'Titik Buhul', bobot: 8, tipe: 'mc',
    pertanyaan: 'Titik buhul: 3 batang (2 segaris horizontal + 1 vertikal), tanpa beban luar. Gaya batang vertikal:',
    opsi: [
      { val: 'A', text: 'Sama dengan kedua batang horizontal' },
      { val: 'B', text: 'Nol (zero-force member)' },
      { val: 'C', text: 'Setengah dari gaya horizontal' },
      { val: 'D', text: 'Tidak dapat ditentukan' }
    ],
    benar: 'B',
    pembahasan: 'ΣFy=0: hanya batang vertikal yang punya komponen vertikal → S_vertikal = 0.'
  },
  {
    id: 'q12', topik: 'Titik Buhul', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Segitiga sama sisi, sisi 6m. A=sendi, B=rol, P=12kN ↓ di C (puncak). Hitung |S_BC|.',
    figure: 'Sudut tiap batang miring = 60°\nsin 60° ≈ 0,866 ; cos 60° = 0,50',
    inputs: [
      { id: 'nilai', label: '|S_BC| =', satuan: 'kN', benar: 6.93, tol: 0.15, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tekan', poin: 5 }
    ],
    pembahasan: 'V_A=V_B=6 kN. Di B: ΣFy = 6 + S_BC×0,866 = 0 → S_BC = −6,93 kN → TEKAN.'
  },
  {
    id: 'q13', topik: 'Titik Buhul', bobot: 8, tipe: 'dual',
    pertanyaan: 'Kantilever: batang AB horizontal (4m), batang BC miring 30° dari horizontal, beban 5kN ↓ di B. Hitung |S_AB|.',
    figure: 'sin 30° = 0,50 ; cos 30° = 0,866',
    inputs: [
      { id: 'nilai', label: '|S_AB| =', satuan: 'kN', benar: 8.66, tol: 0.2, poin: 8 }
    ],
    pembahasan: 'Di B: ΣFy = −5 + S_BC×0,50 = 0 → S_BC = 10 kN. ΣFx: |S_AB| = 10×0,866 = 8,66 kN.'
  },

  // === METODE POTONGAN RITTER (5 soal) ===
  {
    id: 'q14', topik: 'Ritter', bobot: 8, tipe: 'dual',
    pertanyaan: 'Pratt 4 panel @4m (bentang 16m), tinggi 3m. P_B=10kN, P_C=20kN, P_D=10kN. Hitung V_A.',
    inputs: [
      { id: 'nilai', label: 'V_A =', satuan: 'kN', benar: 20, tol: 0.1, poin: 8 }
    ],
    pembahasan: 'Simetris. Total beban 40 kN. V_A = V_E = 20 kN.'
  },
  {
    id: 'q15', topik: 'Ritter', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Pratt: potongan antara panel 2 dan 3. Hitung |S_FG| (chord atas) dengan ΣM_C=0.',
    figure: 'Tinggi h = 3m.',
    inputs: [
      { id: 'nilai', label: '|S_FG| =', satuan: 'kN', benar: 40, tol: 0.2, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tekan', poin: 5 }
    ],
    pembahasan: 'ΣM_C kiri: V_A×8 − P_B×4 = S_FG×3 → S_FG = (160−40)/3 = 40 kN, TEKAN.'
  },
  {
    id: 'q16', topik: 'Ritter', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Lanjutan: hitung |S_BC| (chord bawah) pada potongan yang sama.',
    inputs: [
      { id: 'nilai', label: '|S_BC| =', satuan: 'kN', benar: 26.67, tol: 0.2, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tarik', poin: 5 }
    ],
    pembahasan: 'ΣM_F kiri: V_A×4 = S_BC×3 → S_BC = 80/3 = 26,67 kN, TARIK.'
  },
  {
    id: 'q17', topik: 'Ritter', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Lanjutan: hitung |S_FC| (diagonal) dengan ΣFy=0.',
    figure: 'sin α = 3/5 = 0,60',
    inputs: [
      { id: 'nilai', label: '|S_FC| =', satuan: 'kN', benar: 16.67, tol: 0.15, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tarik', poin: 5 }
    ],
    pembahasan: 'ΣFy kiri: 20−10 = 0,60 S_FC → S_FC = 16,67 kN, TARIK.'
  },
  {
    id: 'q18', topik: 'Ritter', bobot: 8, tipe: 'mc',
    pertanyaan: 'Keunggulan metode potongan Ritter dibanding titik buhul:',
    opsi: [
      { val: 'A', text: 'Dapat menyelesaikan rangka statis tak tentu' },
      { val: 'B', text: 'Lebih cepat untuk mencari gaya batang spesifik di tengah rangka tanpa analisis semua titik buhul' },
      { val: 'C', text: 'Tidak memerlukan perhitungan reaksi tumpuan' },
      { val: 'D', text: 'Lebih akurat secara numerik' }
    ],
    benar: 'B',
    pembahasan: 'Metode potongan efisien untuk batang spesifik di interior rangka — 1 potongan + 3 persamaan keseimbangan.'
  }
];
