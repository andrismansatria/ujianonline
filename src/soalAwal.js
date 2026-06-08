// Bank soal awal — import sekali ke database via dashboard dosen
export const KODE_UJIAN = 'UTS-RANGKA-2026';

export const SOAL_AWAL = [
  // === KONSEP ===
  { nomor: 1, topik: 'Konsep', bobot: 5, tipe: 'mc',
    pertanyaan: 'Manakah yang BUKAN asumsi dasar rangka batang ideal?',
    opsi: [
      { val: 'A', text: 'Sambungan antar batang dianggap sebagai sendi sempurna' },
      { val: 'B', text: 'Beban hanya bekerja pada titik buhul' },
      { val: 'C', text: 'Batang menerima gaya aksial dan momen lentur bersamaan' },
      { val: 'D', text: 'Sumbu batang berimpit dengan garis hubung dua titik buhulnya' }
    ],
    benar: 'C',
    pembahasan: 'Pada rangka ideal, setiap batang HANYA menerima gaya aksial (tarik/tekan).'
  },
  { nomor: 2, topik: 'Konsep', bobot: 8, tipe: 'mc',
    pertanyaan: 'Rangka bidang dengan b=13, r=3, j=8. Termasuk struktur apa?',
    figure: 'Rumus: b + r ? 2j',
    opsi: [
      { val: 'A', text: 'Statis tak tentu' },
      { val: 'B', text: 'Statis tertentu' },
      { val: 'C', text: 'Labil / mekanisme' },
      { val: 'D', text: 'Tidak dapat ditentukan tanpa gambar' }
    ],
    benar: 'B',
    pembahasan: 'b+r = 16 = 2j → statis tertentu.'
  },
  { nomor: 3, topik: 'Konsep', bobot: 8, tipe: 'mc',
    pertanyaan: 'Rangka bidang dengan b=10, r=3, j=7. Termasuk struktur apa?',
    opsi: [
      { val: 'A', text: 'Statis tertentu' },
      { val: 'B', text: 'Statis tak tentu derajat 1' },
      { val: 'C', text: 'Labil dengan 1 derajat kebebasan' },
      { val: 'D', text: 'Statis tak tentu derajat 2' }
    ],
    benar: 'C',
    pembahasan: 'b+r = 13 < 2j = 14 → LABIL.'
  },
  { nomor: 4, topik: 'Konsep', bobot: 8, tipe: 'mc',
    pertanyaan: 'Rangka bidang dengan b=15, r=3, j=8. Derajat ketidaktentuan statis?',
    opsi: [
      { val: 'A', text: '0' }, { val: 'B', text: '1' },
      { val: 'C', text: '2' }, { val: 'D', text: '3' }
    ],
    benar: 'C',
    pembahasan: 'b+r=18, 2j=16. Derajat = 18-16 = 2.'
  },
  { nomor: 5, topik: 'Konsep', bobot: 5, tipe: 'mc',
    pertanyaan: 'Batang nol (zero-force) umumnya terjadi pada:',
    opsi: [
      { val: 'A', text: 'Titik buhul dengan 2 batang tidak segaris tanpa beban' },
      { val: 'B', text: 'Titik buhul yang memikul beban terbesar' },
      { val: 'C', text: 'Batang tepi atas' },
      { val: 'D', text: 'Batang terpanjang' }
    ],
    benar: 'A',
    pembahasan: '2 batang tidak segaris tanpa beban → ΣFx=ΣFy=0 → keduanya nol.'
  },
  { nomor: 6, topik: 'Konsep', bobot: 6, tipe: 'mc',
    pertanyaan: 'Pernyataan BENAR tentang batang nol:',
    opsi: [
      { val: 'A', text: 'Tidak perlu dipasang' },
      { val: 'B', text: 'Tetap dibutuhkan untuk stabilitas & mengubah panjang tekuk' },
      { val: 'C', text: 'Mengalami momen tapi tidak gaya aksial' },
      { val: 'D', text: 'Hanya muncul pada rangka statis tak tentu' }
    ],
    benar: 'B',
    pembahasan: 'Batang nol penting untuk stabilitas geometris & memperpendek panjang tekuk.'
  },
  // === TITIK BUHUL ===
  { nomor: 7, topik: 'Titik Buhul', bobot: 8, tipe: 'dual',
    pertanyaan: 'Rangka segitiga: AB=8m, tinggi C=3m, beban P=20kN ke bawah di C. Hitung V_A.',
    figure: '       C  P=20 kN ↓\n      /\\\n     /  \\  AC=BC=5m\n    /____\\\n   A  8m  B',
    inputs: [{ id: 'nilai', label: 'V_A =', satuan: 'kN', benar: 10, tol: 0.1, poin: 8 }],
    pembahasan: 'Simetris. V_A = V_B = 10 kN.'
  },
  { nomor: 8, topik: 'Titik Buhul', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Lanjutan: hitung |S_AC| dan jenisnya (di titik A).',
    figure: 'sin θ = 3/5 = 0,60 ; cos θ = 4/5 = 0,80',
    inputs: [
      { id: 'nilai', label: '|S_AC| =', satuan: 'kN', benar: 16.67, tol: 0.15, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tekan', poin: 5 }
    ],
    pembahasan: 'ΣFy di A: 10 + S×0,60 = 0 → S = −16,67 kN → TEKAN.'
  },
  { nomor: 9, topik: 'Titik Buhul', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Lanjutan: hitung |S_AB| dan jenisnya.',
    inputs: [
      { id: 'nilai', label: '|S_AB| =', satuan: 'kN', benar: 13.33, tol: 0.15, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tarik', poin: 5 }
    ],
    pembahasan: 'ΣFx: −16,67×0,80 + S_AB = 0 → S_AB = 13,33 kN → TARIK.'
  },
  { nomor: 10, topik: 'Titik Buhul', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Rangka K: bentang 6m, tinggi 4m, P=30kN di puncak. Hitung gaya batang diagonal.',
    figure: 'sin θ = 4/5 = 0,80 ; cos θ = 3/5 = 0,60',
    inputs: [
      { id: 'nilai', label: '|S_diagonal| =', satuan: 'kN', benar: 18.75, tol: 0.2, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tekan', poin: 5 }
    ],
    pembahasan: 'V=15 kN. S = −15/0,80 = −18,75 kN → TEKAN.'
  },
  { nomor: 11, topik: 'Titik Buhul', bobot: 8, tipe: 'mc',
    pertanyaan: 'Titik buhul: 2 batang horizontal segaris + 1 vertikal, tanpa beban. Gaya batang vertikal:',
    opsi: [
      { val: 'A', text: 'Sama dengan horizontal' },
      { val: 'B', text: 'Nol (zero-force)' },
      { val: 'C', text: 'Setengah horizontal' },
      { val: 'D', text: 'Tidak dapat ditentukan' }
    ],
    benar: 'B',
    pembahasan: 'ΣFy: hanya batang vertikal punya komponen y → S_vertikal=0.'
  },
  { nomor: 12, topik: 'Titik Buhul', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Segitiga sama sisi sisi 6m, P=12kN di puncak. Hitung |S_BC|.',
    figure: 'sin 60° ≈ 0,866 ; cos 60° = 0,50',
    inputs: [
      { id: 'nilai', label: '|S_BC| =', satuan: 'kN', benar: 6.93, tol: 0.15, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tekan', poin: 5 }
    ],
    pembahasan: 'V=6 kN. S = −6/0,866 = −6,93 kN → TEKAN.'
  },
  { nomor: 13, topik: 'Titik Buhul', bobot: 8, tipe: 'dual',
    pertanyaan: 'Kantilever: AB horizontal 4m, BC miring 30° ke bawah, beban 5kN ↓ di B. Hitung |S_AB|.',
    figure: 'sin 30° = 0,50 ; cos 30° = 0,866',
    inputs: [{ id: 'nilai', label: '|S_AB| =', satuan: 'kN', benar: 8.66, tol: 0.2, poin: 8 }],
    pembahasan: 'S_BC = 10 kN. |S_AB| = 10×0,866 = 8,66 kN.'
  },
  // === RITTER ===
  { nomor: 14, topik: 'Ritter', bobot: 8, tipe: 'dual',
    pertanyaan: 'Pratt 4 panel @4m (16m), tinggi 3m. P_B=10, P_C=20, P_D=10 kN. V_A=?',
    inputs: [{ id: 'nilai', label: 'V_A =', satuan: 'kN', benar: 20, tol: 0.1, poin: 8 }],
    pembahasan: 'Simetris: V_A = V_E = 20 kN.'
  },
  { nomor: 15, topik: 'Ritter', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Potongan panel 2-3, ΣM_C=0. Hitung |S_FG| (chord atas).',
    figure: 'Tinggi h = 3m',
    inputs: [
      { id: 'nilai', label: '|S_FG| =', satuan: 'kN', benar: 40, tol: 0.2, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tekan', poin: 5 }
    ],
    pembahasan: 'V_A×8 − P_B×4 = S_FG×3 → S_FG = 40 kN, TEKAN.'
  },
  { nomor: 16, topik: 'Ritter', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Lanjutan: hitung |S_BC| (chord bawah).',
    inputs: [
      { id: 'nilai', label: '|S_BC| =', satuan: 'kN', benar: 26.67, tol: 0.2, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tarik', poin: 5 }
    ],
    pembahasan: 'ΣM_F: V_A×4 = S_BC×3 → S_BC = 26,67 kN, TARIK.'
  },
  { nomor: 17, topik: 'Ritter', bobot: 10, tipe: 'numjenis',
    pertanyaan: 'Lanjutan: hitung |S_FC| (diagonal) via ΣFy=0.',
    figure: 'sin α = 3/5 = 0,60',
    inputs: [
      { id: 'nilai', label: '|S_FC| =', satuan: 'kN', benar: 16.67, tol: 0.15, poin: 5 },
      { id: 'jenis', label: 'Jenis:', benar: 'tarik', poin: 5 }
    ],
    pembahasan: '20−10 = 0,60×S_FC → S_FC = 16,67 kN, TARIK.'
  },
  { nomor: 18, topik: 'Ritter', bobot: 8, tipe: 'mc',
    pertanyaan: 'Keunggulan metode Ritter dibanding titik buhul:',
    opsi: [
      { val: 'A', text: 'Bisa selesaikan rangka statis tak tentu' },
      { val: 'B', text: 'Cepat untuk batang spesifik di tengah rangka' },
      { val: 'C', text: 'Tidak perlu reaksi tumpuan' },
      { val: 'D', text: 'Lebih akurat secara numerik' }
    ],
    benar: 'B',
    pembahasan: 'Efisien: 1 potongan + 3 persamaan keseimbangan.'
  }
];
