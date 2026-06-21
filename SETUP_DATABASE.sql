-- =====================================================
-- MIGRATION LENGKAP UTS RANGKA BATANG
-- v1 + v2 + v3 dalam satu file
-- Aman dijalankan berulang (pakai IF NOT EXISTS)
-- =====================================================
-- Cara pakai:
-- 1. Buka Supabase → SQL Editor → + New query
-- 2. Salin SELURUH isi file ini
-- 3. Klik Run
-- 4. Harus muncul "Success. No rows returned"
-- =====================================================


-- ===========================================
-- BAGIAN 1: TABEL DASAR (v1)
-- ===========================================

-- Tabel hasil ujian mahasiswa
CREATE TABLE IF NOT EXISTS hasil_uts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  nama TEXT NOT NULL,
  nim TEXT NOT NULL,
  kelas TEXT,
  total_skor NUMERIC NOT NULL,
  total_bobot NUMERIC NOT NULL,
  persen NUMERIC NOT NULL,
  grade TEXT NOT NULL,
  jumlah_dijawab INT,
  detail JSONB
);

-- RLS untuk hasil_uts
ALTER TABLE hasil_uts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "siapa pun bisa lihat hasil" ON hasil_uts;
CREATE POLICY "siapa pun bisa lihat hasil"
  ON hasil_uts FOR SELECT USING (true);

DROP POLICY IF EXISTS "siapa pun bisa submit" ON hasil_uts;
CREATE POLICY "siapa pun bisa submit"
  ON hasil_uts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "siapa pun bisa hapus" ON hasil_uts;
CREATE POLICY "siapa pun bisa hapus"
  ON hasil_uts FOR DELETE USING (true);


-- ===========================================
-- BAGIAN 2: FUNCTION TIMESTAMP AUTO-UPDATE
-- (dipakai oleh trigger di bawah)
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ===========================================
-- BAGIAN 3: BANK SOAL (v2)
-- ===========================================

CREATE TABLE IF NOT EXISTS bank_soal (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  kode_ujian TEXT NOT NULL DEFAULT 'UTS-RANGKA-2026',
  nomor INT,
  topik TEXT NOT NULL,
  bobot INT NOT NULL DEFAULT 5,
  tipe TEXT NOT NULL CHECK (tipe IN ('mc', 'dual', 'numjenis')),
  pertanyaan TEXT NOT NULL,
  figure TEXT,
  opsi JSONB,
  benar TEXT,
  inputs JSONB,
  pembahasan TEXT,
  aktif BOOLEAN DEFAULT true
);

-- Tambah kolom kode_ujian di hasil_uts kalau belum ada
ALTER TABLE hasil_uts
  ADD COLUMN IF NOT EXISTS kode_ujian TEXT DEFAULT 'UTS-RANGKA-2026';

-- Index untuk cek cepat NIM yang sudah submit
CREATE INDEX IF NOT EXISTS idx_hasil_nim_kode ON hasil_uts(nim, kode_ujian);

-- RLS untuk bank_soal
ALTER TABLE bank_soal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "siapa pun bisa baca soal" ON bank_soal;
CREATE POLICY "siapa pun bisa baca soal"
  ON bank_soal FOR SELECT USING (true);

DROP POLICY IF EXISTS "siapa pun bisa insert soal" ON bank_soal;
CREATE POLICY "siapa pun bisa insert soal"
  ON bank_soal FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "siapa pun bisa update soal" ON bank_soal;
CREATE POLICY "siapa pun bisa update soal"
  ON bank_soal FOR UPDATE USING (true);

DROP POLICY IF EXISTS "siapa pun bisa hapus soal" ON bank_soal;
CREATE POLICY "siapa pun bisa hapus soal"
  ON bank_soal FOR DELETE USING (true);

-- Trigger auto-update updated_at di bank_soal
DROP TRIGGER IF EXISTS trg_bank_soal_updated ON bank_soal;
CREATE TRIGGER trg_bank_soal_updated
  BEFORE UPDATE ON bank_soal
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ===========================================
-- BAGIAN 4: KONFIGURASI UJIAN (v3)
-- ===========================================

CREATE TABLE IF NOT EXISTS konfigurasi_ujian (
  kode_ujian TEXT PRIMARY KEY,
  judul TEXT NOT NULL,
  durasi_menit INT NOT NULL DEFAULT 120,
  status TEXT NOT NULL DEFAULT 'tutup' CHECK (status IN ('buka', 'tutup')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Isi konfigurasi default
INSERT INTO konfigurasi_ujian (kode_ujian, judul, durasi_menit, status)
VALUES ('UTS-RANGKA-2026', 'UTS Analisis Struktur Rangka Batang', 120, 'buka')
ON CONFLICT (kode_ujian) DO NOTHING;

-- RLS untuk konfigurasi_ujian
ALTER TABLE konfigurasi_ujian ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "baca config" ON konfigurasi_ujian;
CREATE POLICY "baca config"
  ON konfigurasi_ujian FOR SELECT USING (true);

DROP POLICY IF EXISTS "update config" ON konfigurasi_ujian;
CREATE POLICY "update config"
  ON konfigurasi_ujian FOR UPDATE USING (true);

DROP POLICY IF EXISTS "insert config" ON konfigurasi_ujian;
CREATE POLICY "insert config"
  ON konfigurasi_ujian FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "hapus config" ON konfigurasi_ujian;
CREATE POLICY "hapus config"
  ON konfigurasi_ujian FOR DELETE USING (true);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_config_updated ON konfigurasi_ujian;
CREATE TRIGGER trg_config_updated
  BEFORE UPDATE ON konfigurasi_ujian
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ===========================================
-- BAGIAN 5: SESI UJIAN (v3)
-- ===========================================

CREATE TABLE IF NOT EXISTS sesi_ujian (
  id BIGSERIAL PRIMARY KEY,
  kode_ujian TEXT NOT NULL,
  nim TEXT NOT NULL,
  nama TEXT NOT NULL,
  kelas TEXT,
  waktu_mulai TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  waktu_selesai TIMESTAMPTZ,
  durasi_menit INT NOT NULL,
  pindah_tab_count INT DEFAULT 0,
  status TEXT DEFAULT 'aktif' CHECK (status IN ('aktif', 'selesai', 'expired')),
  UNIQUE(kode_ujian, nim)
);

CREATE INDEX IF NOT EXISTS idx_sesi_nim ON sesi_ujian(nim, kode_ujian);

-- Tambah kolom anti-curang di hasil_uts
ALTER TABLE hasil_uts
  ADD COLUMN IF NOT EXISTS pindah_tab_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS durasi_pengerjaan_detik INT,
  ADD COLUMN IF NOT EXISTS auto_submit BOOLEAN DEFAULT false;

-- RLS untuk sesi_ujian
ALTER TABLE sesi_ujian ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "baca sesi" ON sesi_ujian;
CREATE POLICY "baca sesi"
  ON sesi_ujian FOR SELECT USING (true);

DROP POLICY IF EXISTS "update sesi" ON sesi_ujian;
CREATE POLICY "update sesi"
  ON sesi_ujian FOR UPDATE USING (true);

DROP POLICY IF EXISTS "insert sesi" ON sesi_ujian;
CREATE POLICY "insert sesi"
  ON sesi_ujian FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "hapus sesi" ON sesi_ujian;
CREATE POLICY "hapus sesi"
  ON sesi_ujian FOR DELETE USING (true);


-- ===========================================
-- SELESAI!
-- ===========================================
-- Setelah ini berhasil, di Supabase Table Editor harus ada 4 tabel:
-- 1. hasil_uts
-- 2. bank_soal
-- 3. konfigurasi_ujian
-- 4. sesi_ujian
--
-- Berikutnya: login ke aplikasi sebagai Dosen → tab "Bank Soal"
-- → klik "Import 18 Soal Awal" untuk mengisi bank soal awal.
-- ===========================================
-- =====================================================
-- IMPORT BANK SOAL UTS ANALISIS STRUKTUR 2
-- Materi: Metode Titik Buhul, Ritter, Cremona
-- Total: 24 soal, bobot 200 poin
-- =====================================================
-- Cara pakai:
-- 1. Supabase → SQL Editor → + New query
-- 2. Salin SELURUH isi file ini
-- 3. Klik Run
-- 4. Buka aplikasi → Dashboard Dosen → tab Bank Soal
--    → 24 soal akan muncul
-- =====================================================

-- Pastikan ada konfigurasi ujian untuk kode UTS-ASII-2026
INSERT INTO konfigurasi_ujian (kode_ujian, judul, durasi_menit, status)
VALUES ('UTS-ASII-2026', 'UTS Analisis Struktur 2', 120, 'tutup')
ON CONFLICT (kode_ujian) DO NOTHING;

-- ============= METODE TITIK BUHUL (8 soal) =============
INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UTS-ASII-2026', 1, 'Titik Buhul', 5, 'mc',
 'Prinsip dasar metode keseimbangan titik buhul (joint equilibrium) adalah:',
 NULL,
 '[{"val":"A","text":"Setiap titik buhul harus memenuhi ΣFx = 0 dan ΣFy = 0"},{"val":"B","text":"Setiap potongan harus memenuhi ΣM = 0"},{"val":"C","text":"Setiap batang harus memiliki gaya tarik"},{"val":"D","text":"Setiap reaksi tumpuan harus sama besar"}]'::jsonb,
 'A', NULL,
 'Karena rangka batang ideal hanya menerima gaya aksial dan tidak ada momen di titik buhul, maka di setiap titik buhul berlaku 2 persamaan keseimbangan: ΣFx = 0 dan ΣFy = 0.',
 true),

('UTS-ASII-2026', 2, 'Titik Buhul', 6, 'mc',
 'Urutan analisis yang BENAR pada metode titik buhul adalah:',
 NULL,
 '[{"val":"A","text":"Mulai dari titik buhul mana saja, cari gaya batang"},{"val":"B","text":"Hitung reaksi tumpuan dulu, lalu mulai dari titik buhul dengan maksimal 2 batang yang belum diketahui"},{"val":"C","text":"Hitung semua gaya batang sekaligus dengan sistem persamaan"},{"val":"D","text":"Mulai dari titik tengah rangka, menyebar ke tepi"}]'::jsonb,
 'B', NULL,
 'Tiap titik buhul hanya menyediakan 2 persamaan (ΣFx, ΣFy), jadi harus dimulai dari titik dengan maksimal 2 batang yang belum diketahui. Reaksi tumpuan wajib dicari lebih dulu agar titik buhul tumpuan bisa dianalisis.',
 true),

('UTS-ASII-2026', 3, 'Titik Buhul', 8, 'dual',
 'Rangka segitiga sama kaki: bentang AB = 10 m, tinggi puncak C = 4 m di tengah, beban P = 24 kN turun di C. A = sendi (kiri), B = rol (kanan). Hitung reaksi V_A.',
 E'       C  P = 24 kN turun\n      /\\\n     /  \\   AC = BC = √(5² + 4²) = √41 ≈ 6,40 m\n    /    \\\n   /______\\\n  A   10 m  B',
 NULL, NULL,
 '[{"id":"nilai","label":"V_A =","satuan":"kN","benar":12,"tol":0.1,"poin":8}]'::jsonb,
 'Beban simetris di tengah bentang. ΣM_A = 0: V_B × 10 = 24 × 5 → V_B = 12 kN. V_A = 24 − 12 = 12 kN ke atas.',
 true),

('UTS-ASII-2026', 4, 'Titik Buhul', 10, 'numjenis',
 'Lanjutan Soal 3: hitung |S_AC| dan jenis gayanya menggunakan keseimbangan di titik A.',
 E'Geometri: AC = √41 ≈ 6,40 m\nsin θ = 4/√41 ≈ 0,625\ncos θ = 5/√41 ≈ 0,781',
 NULL, NULL,
 '[{"id":"nilai","label":"|S_AC| =","satuan":"kN","benar":19.21,"tol":0.3,"poin":5},{"id":"jenis","label":"Jenis:","benar":"tekan","poin":5}]'::jsonb,
 'Di titik A, asumsi S_AC tarik (menjauh dari A): ΣFy = V_A + S_AC × sin θ = 0 → 12 + S_AC × 0,625 = 0 → S_AC = −19,21 kN. Tanda minus berarti TEKAN sebesar 19,21 kN.',
 true),

('UTS-ASII-2026', 5, 'Titik Buhul', 10, 'numjenis',
 'Lanjutan: hitung |S_AB| (chord bawah) dan jenisnya.',
 NULL, NULL, NULL,
 '[{"id":"nilai","label":"|S_AB| =","satuan":"kN","benar":15.00,"tol":0.2,"poin":5},{"id":"jenis","label":"Jenis:","benar":"tarik","poin":5}]'::jsonb,
 'ΣFx di A: S_AC × cos θ + S_AB = 0 → (−19,21)(0,781) + S_AB = 0 → S_AB = +15,00 kN → TARIK (sebagai tie/dasi).',
 true),

('UTS-ASII-2026', 6, 'Titik Buhul', 8, 'mc',
 'Pada titik buhul terdapat 4 batang: dua segaris horizontal, dua segaris vertikal, tanpa beban luar. Berapa banyak batang nol di titik tersebut?',
 NULL,
 '[{"val":"A","text":"0 batang nol"},{"val":"B","text":"1 batang nol"},{"val":"C","text":"2 batang nol"},{"val":"D","text":"Semua 4 batang adalah nol"}]'::jsonb,
 'A', NULL,
 'Untuk dua pasang batang yang masing-masing segaris, ΣFx dan ΣFy memberi: batang horizontal saling menyeimbangkan, batang vertikal saling menyeimbangkan. Tidak ada yang harus nol; semua bisa bernilai (besar yang sama untuk tiap pasang).',
 true),

('UTS-ASII-2026', 7, 'Titik Buhul', 10, 'numjenis',
 'Rangka kantilever: dua batang dari tembok — AB horizontal (panjang 3m), AC miring 30° dari horizontal. Beban vertikal P = 8 kN ↓ di titik A. Hitung |S_AC| dan jenisnya.',
 E'sin 30° = 0,50 ; cos 30° = 0,866',
 NULL, NULL,
 '[{"id":"nilai","label":"|S_AC| =","satuan":"kN","benar":16.00,"tol":0.3,"poin":5},{"id":"jenis","label":"Jenis:","benar":"tarik","poin":5}]'::jsonb,
 'Di A: ΣFy = −P + S_AC × sin 30° = 0 → S_AC = 8/0,50 = 16 kN, TARIK (menarik A ke arah C).',
 true),

('UTS-ASII-2026', 8, 'Titik Buhul', 8, 'dual',
 'Lanjutan: hitung |S_AB| dari soal sebelumnya.',
 NULL, NULL, NULL,
 '[{"id":"nilai","label":"|S_AB| =","satuan":"kN","benar":13.86,"tol":0.3,"poin":8}]'::jsonb,
 'ΣFx di A: S_AB + S_AC × cos 30° = 0 → S_AB = −16 × 0,866 = −13,86 kN. |S_AB| = 13,86 kN (jenis TEKAN, batang mendesak A).',
 true);

-- ============= METODE RITTER (8 soal) =============
INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UTS-ASII-2026', 9, 'Ritter', 5, 'mc',
 'Metode potongan Ritter paling efisien dipakai untuk:',
 NULL,
 '[{"val":"A","text":"Mencari semua gaya batang dalam rangka"},{"val":"B","text":"Mencari gaya 3 batang tertentu di bagian tengah rangka"},{"val":"C","text":"Menghitung reaksi tumpuan"},{"val":"D","text":"Menganalisis rangka statis tak tentu"}]'::jsonb,
 'B', NULL,
 'Metode Ritter: satu potongan memotong maksimal 3 batang yang tidak diketahui → 3 persamaan keseimbangan menyelesaikan 3 gaya batang. Sangat efisien untuk batang spesifik di interior rangka.',
 true),

('UTS-ASII-2026', 10, 'Ritter', 6, 'mc',
 'Untuk mencari gaya pada CHORD ATAS (top chord) dengan metode Ritter, persamaan yang paling tepat dipakai adalah:',
 NULL,
 '[{"val":"A","text":"ΣFx = 0 pada bagian yang dipotong"},{"val":"B","text":"ΣFy = 0 pada bagian yang dipotong"},{"val":"C","text":"ΣM = 0 terhadap titik buhul di chord bawah yang sebaris dengan potongan"},{"val":"D","text":"ΣM = 0 terhadap titik tumpuan"}]'::jsonb,
 'C', NULL,
 'ΣM terhadap titik buhul bawah (titik tempat 2 batang lain — chord bawah & diagonal — berpotongan) akan mengeliminasi 2 gaya tersebut, sehingga hanya gaya chord atas yang tersisa di persamaan momen.',
 true),

('UTS-ASII-2026', 11, 'Ritter', 8, 'dual',
 'Rangka Pratt 6 panel @3m (bentang 18m), tinggi 4m. Beban di chord bawah: P₂=15kN, P₃=20kN, P₄=20kN, P₅=15kN (semua turun). Tumpuan sendi di 1, rol di 6. Hitung reaksi V_1.',
 E'Panel: 1─2─3─4─5─6 (chord bawah)\nBeban simetris di tengah\nTotal beban = 15+20+20+15 = 70 kN',
 NULL, NULL,
 '[{"id":"nilai","label":"V_1 =","satuan":"kN","benar":35,"tol":0.2,"poin":8}]'::jsonb,
 'Beban simetris terhadap titik tengah bentang. Total = 70 kN. V_1 = V_6 = 70/2 = 35 kN ke atas.',
 true),

('UTS-ASII-2026', 12, 'Ritter', 10, 'numjenis',
 'Lanjutan Soal 11: potongan vertikal antara panel 2 dan 3, hitung |S_chord_atas| menggunakan ΣM di buhul 3.',
 E'Tinggi h = 4 m\nJarak buhul 1 ke 3 = 6 m\nJarak buhul 2 ke 3 = 3 m',
 NULL, NULL,
 '[{"id":"nilai","label":"|S_chord_atas| =","satuan":"kN","benar":41.25,"tol":0.5,"poin":5},{"id":"jenis","label":"Jenis:","benar":"tekan","poin":5}]'::jsonb,
 'ΣM₃ bagian kiri: V_1×6 − P₂×3 − S_atas×4 = 0 → 35×6 − 15×3 = 4×S → S = (210−45)/4 = 41,25 kN. Chord atas pada beban gravitasi = TEKAN.',
 true),

('UTS-ASII-2026', 13, 'Ritter', 10, 'numjenis',
 'Lanjutan: hitung |S_chord_bawah| (antara buhul 2 dan 3) menggunakan ΣM di buhul atas yang sebaris dengan buhul 2.',
 E'Lengan momen S_chord_bawah terhadap titik itu = tinggi h = 4 m\nLengan momen V_1 = 3 m',
 NULL, NULL,
 '[{"id":"nilai","label":"|S_chord_bawah| =","satuan":"kN","benar":26.25,"tol":0.5,"poin":5},{"id":"jenis","label":"Jenis:","benar":"tarik","poin":5}]'::jsonb,
 'ΣM buhul atas (di atas buhul 2) bagian kiri: V_1×3 − S_bawah×4 = 0 (P₂ tidak punya lengan momen karena segaris vertikal). S = 35×3/4 = 26,25 kN, TARIK.',
 true),

('UTS-ASII-2026', 14, 'Ritter', 10, 'numjenis',
 'Lanjutan: hitung |S_diagonal| pada potongan yang sama menggunakan ΣFy = 0 pada bagian kiri.',
 E'Diagonal: panjang √(3² + 4²) = 5 m\nsin α = 4/5 = 0,80',
 NULL, NULL,
 '[{"id":"nilai","label":"|S_diagonal| =","satuan":"kN","benar":25.00,"tol":0.3,"poin":5},{"id":"jenis","label":"Jenis:","benar":"tarik","poin":5}]'::jsonb,
 'ΣFy kiri: V_1 − P₂ − S_diag × sin α = 0 → 35 − 15 = S_diag × 0,80 → S_diag = 25 kN. Diagonal Pratt yang turun ke arah tengah bentang = TARIK.',
 true),

('UTS-ASII-2026', 15, 'Ritter', 8, 'mc',
 'Pada rangka Howe (kebalikan dari Pratt — diagonal naik ke arah tengah), saat beban gravitasi, diagonalnya akan mengalami:',
 NULL,
 '[{"val":"A","text":"Tarik, sama seperti Pratt"},{"val":"B","text":"Tekan"},{"val":"C","text":"Nol (zero-force)"},{"val":"D","text":"Tergantung beban"}]'::jsonb,
 'B', NULL,
 'Arah diagonal Howe terbalik dari Pratt. Karena geometri terbalik, gaya internalnya juga terbalik tanda: diagonal Howe = TEKAN pada beban gravitasi.',
 true),

('UTS-ASII-2026', 16, 'Ritter', 10, 'dual',
 'Rangka Pratt 4 panel @4m, tinggi 3m. Beban di chord atas: P=12kN turun di tiap 3 buhul atas (total 36 kN). Hitung V_A.',
 E'Beban total = 3 × 12 = 36 kN\nBeban simetris',
 NULL, NULL,
 '[{"id":"nilai","label":"V_A =","satuan":"kN","benar":18,"tol":0.2,"poin":10}]'::jsonb,
 'Beban simetris, walau di chord atas. V_A = V_E = 36/2 = 18 kN ke atas.',
 true);

-- ============= METODE CREMONA (8 soal) =============
INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UTS-ASII-2026', 17, 'Cremona', 6, 'mc',
 'Metode Cremona adalah metode penyelesaian rangka batang berdasarkan:',
 NULL,
 '[{"val":"A","text":"Persamaan keseimbangan numerik di tiap titik buhul"},{"val":"B","text":"Konstruksi grafis (gambar) poligon gaya tertutup di tiap titik buhul"},{"val":"C","text":"Potongan dan momen"},{"val":"D","text":"Persamaan diferensial pegas"}]'::jsonb,
 'B', NULL,
 'Metode Cremona menggunakan pendekatan GRAFIS: poligon gaya tertutup digambar untuk tiap titik buhul (skala panjang vektor = besar gaya). Semua poligon disatukan dalam satu diagram disebut "Cremona".',
 true),

('UTS-ASII-2026', 18, 'Cremona', 6, 'mc',
 'Notasi Bow dalam metode Cremona digunakan untuk:',
 NULL,
 '[{"val":"A","text":"Memberi label angka pada titik buhul"},{"val":"B","text":"Memberi label huruf/angka pada SETIAP RUANG antara batang dan beban"},{"val":"C","text":"Memberi nama batang dengan tarik atau tekan"},{"val":"D","text":"Menentukan skala gambar"}]'::jsonb,
 'B', NULL,
 'Notasi Bow memberi label pada "ruang" yang dibatasi oleh batang/beban/reaksi. Tiap batang kemudian disebut dengan dua label ruang di kanan-kirinya. Memudahkan identifikasi dalam diagram Cremona.',
 true),

('UTS-ASII-2026', 19, 'Cremona', 8, 'mc',
 'Urutan menggambar diagram Cremona yang BENAR:',
 NULL,
 '[{"val":"A","text":"Gambar poligon gaya luar (load line), lalu mulai dari titik buhul dengan maksimal 2 batang tidak diketahui, lanjutkan ke titik buhul berikutnya"},{"val":"B","text":"Gambar semua batang dulu, lalu hitung gayanya"},{"val":"C","text":"Mulai dari titik tengah dan menyebar ke tepi"},{"val":"D","text":"Gambar acak dari titik mana saja"}]'::jsonb,
 'A', NULL,
 'Langkah Cremona: (1) Hitung reaksi tumpuan, (2) Gambar load line — poligon vektor beban+reaksi searah jarum jam, (3) Mulai dari titik dengan max 2 batang belum diketahui, (4) Tutup poligon vektor di tiap titik, lanjut ke titik berikutnya.',
 true),

('UTS-ASII-2026', 20, 'Cremona', 8, 'mc',
 'Pada diagram Cremona, panjang vektor pada gambar merepresentasikan:',
 NULL,
 '[{"val":"A","text":"Panjang fisik batang"},{"val":"B","text":"Besar gaya batang (sesuai skala gaya yang dipilih)"},{"val":"C","text":"Sudut kemiringan batang"},{"val":"D","text":"Reaksi tumpuan saja"}]'::jsonb,
 'B', NULL,
 'Cremona adalah skala vektor gaya. Misal skala 1cm = 10kN, maka vektor 3cm di gambar = gaya 30 kN. Arah vektor SAMA dengan arah batang fisik (karena gaya aksial).',
 true),

('UTS-ASII-2026', 21, 'Cremona', 8, 'mc',
 'Cara menentukan jenis gaya (tarik/tekan) pada metode Cremona:',
 NULL,
 '[{"val":"A","text":"Lihat panjang vektor di diagram"},{"val":"B","text":"Telusuri arah vektor di diagram searah jarum jam mengelilingi titik buhul; arah ini dibandingkan dengan arah batang menjauh/menuju titik buhul"},{"val":"C","text":"Selalu chord atas tekan, chord bawah tarik"},{"val":"D","text":"Dihitung secara numerik terpisah"}]'::jsonb,
 'B', NULL,
 'Konvensi Cremona: telusuri vektor di diagram searah jarum jam (atau berlawanan, konsisten) mengelilingi titik buhul. Jika arah vektor di diagram menjauhi titik buhul → TARIK; menuju titik buhul → TEKAN.',
 true),

('UTS-ASII-2026', 22, 'Cremona', 10, 'numjenis',
 'Rangka segitiga sederhana ABC: bentang AB = 6m, tinggi C = 4m di tengah, beban P = 30kN turun di C, A=sendi, B=rol. Dari Cremona, hitung |S_AC|.',
 E'AC = BC = √(3² + 4²) = 5 m\nsin θ = 4/5 = 0,80 ; cos θ = 3/5 = 0,60\nReaksi: V_A = V_B = 15 kN',
 NULL, NULL,
 '[{"id":"nilai","label":"|S_AC| =","satuan":"kN","benar":18.75,"tol":0.3,"poin":5},{"id":"jenis","label":"Jenis:","benar":"tekan","poin":5}]'::jsonb,
 'Pada Cremona, vektor V_A digambar dulu (15 kN ke atas). Di titik A, tutup poligon vektor: |S_AC| = V_A/sin θ = 15/0,80 = 18,75 kN. Telusur arah → vektor mengarah MENUJU A → TEKAN.',
 true),

('UTS-ASII-2026', 23, 'Cremona', 10, 'numjenis',
 'Lanjutan Soal 22: dari Cremona, hitung |S_AB| (chord bawah).',
 NULL, NULL, NULL,
 '[{"id":"nilai","label":"|S_AB| =","satuan":"kN","benar":11.25,"tol":0.3,"poin":5},{"id":"jenis","label":"Jenis:","benar":"tarik","poin":5}]'::jsonb,
 'Komponen horizontal S_AC = 18,75 × 0,60 = 11,25 kN. Karena poligon harus tertutup di titik A, |S_AB| = 11,25 kN. Arah vektor menjauhi A → TARIK.',
 true),

('UTS-ASII-2026', 24, 'Cremona', 12, 'mc',
 'Keuntungan UTAMA metode Cremona dibanding metode analitis (titik buhul/Ritter) adalah:',
 NULL,
 '[{"val":"A","text":"Lebih akurat secara numerik untuk soal-soal kompleks"},{"val":"B","text":"Cocok untuk rangka statis tak tentu"},{"val":"C","text":"Visual dan cepat untuk rangka dengan banyak batang; semua gaya batang didapat dalam satu diagram terintegrasi"},{"val":"D","text":"Tidak memerlukan perhitungan reaksi tumpuan"}]'::jsonb,
 'C', NULL,
 'Cremona sangat efisien secara visual: SATU diagram berisi SEMUA gaya batang. Cocok untuk rangka dengan banyak batang. Kelemahan: akurasi tergantung skala gambar.',
 true);

-- =====================================================
-- Verifikasi: cek jumlah soal yang berhasil di-insert
-- =====================================================
SELECT 
  topik, 
  COUNT(*) as jumlah_soal, 
  SUM(bobot) as total_bobot 
FROM bank_soal 
WHERE kode_ujian = 'UTS-ASII-2026' 
GROUP BY topik 
ORDER BY topik;
-- IMPORT BANK SOAL UAS ANALISIS STRUKTUR 2
-- 90 soal: 30 Titik Buhul + 30 Ritter + 30 Cremona
-- Total bobot: ~700 poin

INSERT INTO konfigurasi_ujian (kode_ujian, judul, durasi_menit, status)
VALUES ('UAS-ASII-2026', 'UAS Analisis Struktur 2', 150, 'tutup')
ON CONFLICT (kode_ujian) DO NOTHING;

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 1, 'Titik Buhul', 4, 'mc', 'Konvensi tanda yang umum digunakan untuk gaya batang adalah:', NULL, '[{"val": "A", "text": "Positif untuk tekan, negatif untuk tarik"}, {"val": "B", "text": "Positif untuk tarik, negatif untuk tekan"}, {"val": "C", "text": "Selalu positif (besarnya saja)"}, {"val": "D", "text": "Tergantung jenis rangka"}]'::jsonb, 'B', NULL, 'Konvensi standar: tarik (+) artinya batang ditarik menjauh dari titik buhul; tekan (−) artinya batang mendesak titik buhul.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 2, 'Titik Buhul', 5, 'mc', 'Jika di titik buhul ada 3 batang dan satu beban luar P searah salah satu batang, maka:', NULL, '[{"val": "A", "text": "Semua batang nol"}, {"val": "B", "text": "Dua batang lain yang tidak searah dengan P bisa dianalisis dari komponen tegak lurus P"}, {"val": "C", "text": "Batang searah P pasti bernilai sama dengan P"}, {"val": "D", "text": "Tidak dapat dianalisis dengan satu titik buhul"}]'::jsonb, 'B', NULL, 'Beban yang searah salah satu batang hanya mempengaruhi sumbu sejajar. Sumbu tegak lurus tetap memberi persamaan independen untuk dua batang lain.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 3, 'Titik Buhul', 5, 'mc', 'Pernyataan TIDAK BENAR tentang batang nol (zero-force member):', NULL, '[{"val": "A", "text": "Tidak memikul gaya pada konfigurasi pembebanan yang dianalisis"}, {"val": "B", "text": "Boleh dihapus dari struktur tanpa mempengaruhi keseimbangan"}, {"val": "C", "text": "Tetap berperan secara struktural untuk stabilitas pada beban lain"}, {"val": "D", "text": "Berguna mengurangi panjang tekuk batang tekan yang berdekatan"}]'::jsonb, 'B', NULL, 'Walau nol pada beban yang dianalisis, batang ini tidak boleh dihapus — perannya kritis untuk stabilitas geometris dan kondisi pembebanan lain.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 4, 'Titik Buhul', 5, 'mc', 'Rangka bidang dengan tumpuan 1 sendi (2 reaksi) + 1 rol (1 reaksi). Jumlah persamaan keseimbangan yang tersedia adalah:', NULL, '[{"val": "A", "text": "3 persamaan (untuk seluruh struktur) atau 2j persamaan (j = jumlah buhul)"}, {"val": "B", "text": "Hanya 3 persamaan global"}, {"val": "C", "text": "Hanya 2j persamaan"}, {"val": "D", "text": "b persamaan (b = jumlah batang)"}]'::jsonb, 'A', NULL, 'Untuk seluruh struktur: ΣFx=0, ΣFy=0, ΣM=0 (3 pers). Untuk tiap titik buhul: ΣFx=0, ΣFy=0 (2 pers/buhul), total 2j persamaan.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 5, 'Titik Buhul', 4, 'mc', 'Saat titik buhul memiliki 3 batang dan TIDAK ada beban luar, jika 2 batang segaris, maka batang ketiga:', NULL, '[{"val": "A", "text": "Selalu tarik"}, {"val": "B", "text": "Selalu tekan"}, {"val": "C", "text": "Selalu nol (zero-force)"}, {"val": "D", "text": "Sama besar dengan kedua batang segaris"}]'::jsonb, 'C', NULL, '2 batang segaris hanya punya komponen pada satu sumbu. Pada sumbu tegak lurus, hanya batang ketiga yang menyumbang gaya. Tanpa beban luar → ΣF⊥ = 0 → batang ketiga nol.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 6, 'Titik Buhul', 5, 'mc', 'Rangka bidang dengan b=21, r=3, j=12 adalah:', NULL, '[{"val": "A", "text": "Statis tertentu (b+r = 2j)"}, {"val": "B", "text": "Statis tak tentu derajat 1"}, {"val": "C", "text": "Statis tak tentu derajat 2"}, {"val": "D", "text": "Labil"}]'::jsonb, 'A', NULL, 'b+r = 21+3 = 24 ; 2j = 24. Sama → statis tertentu.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 7, 'Titik Buhul', 6, 'mc', 'Konsep yang BENAR tentang penyelesaian titik buhul secara berurutan:', NULL, '[{"val": "A", "text": "Bisa mulai dari titik mana saja"}, {"val": "B", "text": "Selalu mulai dari tumpuan rol"}, {"val": "C", "text": "Mulai dari titik buhul yang punya maksimal 2 batang dengan gaya yang belum diketahui"}, {"val": "D", "text": "Mulai dari titik tengah rangka"}]'::jsonb, 'C', NULL, 'Karena 1 titik buhul = 2 persamaan, maksimal 2 unknown bisa dipecahkan. Mulai dari titik dengan ≤ 2 batang yang belum diketahui.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 8, 'Titik Buhul', 5, 'mc', 'Saat tumpuan sendi diberi reaksi H_A=0, V_A=10kN, di titik buhul A terhubung batang horizontal AB dan batang vertikal AC. Tanpa beban di A, gaya batang AC adalah:', NULL, '[{"val": "A", "text": "10 kN tarik"}, {"val": "B", "text": "10 kN tekan"}, {"val": "C", "text": "0 kN"}, {"val": "D", "text": "Tidak dapat ditentukan"}]'::jsonb, 'B', NULL, 'ΣFy di A: V_A + S_AC = 0 → 10 + S_AC = 0 → S_AC = −10 kN → TEKAN (batang AC mendesak A ke atas, melawan V_A).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 9, 'Titik Buhul', 8, 'dual', 'Rangka segitiga ABC: bentang AB=12m, tinggi C=5m di tengah, beban P=40kN turun di C. A=sendi, B=rol. Hitung V_A.', E'       C  ↓ P=40 kN\n      /\\n     /  \   AC=BC=√61≈7.81m\n   A 12m  B', NULL, NULL, '[{"id": "nilai", "label": "V_A =", "satuan": "kN", "benar": 20, "tol": 0.2, "poin": 8}]'::jsonb, 'Simetris: V_A = V_B = 40/2 = 20 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 10, 'Titik Buhul', 10, 'numjenis', 'Lanjutan: hitung |S_AC| dan jenisnya. (sin θ = 5/√61, cos θ = 6/√61)', 'sin θ ≈ 0,640 ; cos θ ≈ 0,768', NULL, NULL, '[{"id": "nilai", "label": "|S_AC| =", "satuan": "kN", "benar": 31.25, "tol": 0.4, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 5}]'::jsonb, 'ΣFy di A: V_A + S_AC sin θ = 0 → 20 + S_AC×0,640 = 0 → S_AC = −31,25 kN → TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 11, 'Titik Buhul', 8, 'numjenis', 'Lanjutan: hitung |S_AB|.', NULL, NULL, NULL, '[{"id": "nilai", "label": "|S_AB| =", "satuan": "kN", "benar": 24.0, "tol": 0.3, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'ΣFx di A: S_AC cos θ + S_AB = 0 → (−31,25)(0,768) + S_AB = 0 → S_AB = 24 kN, TARIK.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 12, 'Titik Buhul', 9, 'numjenis', 'Rangka segitiga asimetris: A=sendi (0,0), B=rol (8,0), C=puncak (3,4). Beban vertikal P=30kN turun di C. Hitung |S_AC|.', E'AC: panjang √(3²+4²) = 5 m\nsin α = 4/5 = 0,80 ; cos α = 3/5 = 0,60\nBC: panjang √(5²+4²) ≈ 6,40 m\nsin β = 4/6,40 = 0,625 ; cos β = 5/6,40 = 0,781', NULL, NULL, '[{"id": "nilai", "label": "|S_AC| =", "satuan": "kN", "benar": 23.44, "tol": 0.5, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 4}]'::jsonb, 'ΣM_A=0: V_B×8 = 30×3 → V_B=11,25 kN. V_A=18,75 kN. Di A: 18,75 + S_AC×0,80 = 0 → S_AC=−23,44 kN → TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 13, 'Titik Buhul', 6, 'dual', 'Lanjutan soal 12: hitung V_B (reaksi rol).', NULL, NULL, NULL, '[{"id": "nilai", "label": "V_B =", "satuan": "kN", "benar": 11.25, "tol": 0.1, "poin": 6}]'::jsonb, 'ΣM_A = 0: V_B × 8 = 30 × 3 → V_B = 90/8 = 11,25 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 14, 'Titik Buhul', 10, 'numjenis', 'Rangka K-truss simetris: A(0,0)=sendi, B(8,0)=rol, C(4,3)=puncak, D(2,1.5)=titik tengah AC, E(6,1.5)=titik tengah BC. Beban P=24kN turun di C. Hitung |S_AC| (batang dari A ke C, lewat D).', E'AC: lurus dari A(0,0) ke C(4,3), panjang 5 m\nsin θ = 3/5 = 0,60 ; cos θ = 4/5 = 0,80', NULL, NULL, '[{"id": "nilai", "label": "|S_AC| =", "satuan": "kN", "benar": 20.0, "tol": 0.3, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 5}]'::jsonb, 'V_A = V_B = 12 kN. Pada konfigurasi K-truss simetris, batang utama AC dianalisis dari titik A: ΣFy=0 → 12 + S_AC × 0,60 + S_AD × 0,60 = 0. Jika dianggap sebagai batang gabungan S_AC = −20 kN → TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 15, 'Titik Buhul', 7, 'mc', 'Pada rangka tipe Fink (atap pelana), batang vertikal pendek dari puncak ke chord bawah biasanya:', NULL, '[{"val": "A", "text": "Mengalami tarik karena menggantung beban"}, {"val": "B", "text": "Mengalami tekan karena mendesak ke bawah"}, {"val": "C", "text": "Bergaya nol pada beban gravitasi simetris"}, {"val": "D", "text": "Mengalami momen lentur"}]'::jsonb, 'A', NULL, 'Batang vertikal pendek (king post) pada Fink truss menggantung chord bawah yang membentang, sehingga mengalami TARIK.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 16, 'Titik Buhul', 8, 'numjenis', 'Rangka kantilever 3 batang: A(0,3)=engsel, B(4,3)=ujung bebas, C(4,0)=engsel bawah. Batang AB horizontal, AC diagonal, BC vertikal. Beban P=15kN turun di B. Hitung |S_AB|.', E'AC: panjang √(4²+3²) = 5 m\nsin α = 3/5 ; cos α = 4/5\nBC: vertikal 3 m', NULL, NULL, '[{"id": "nilai", "label": "|S_AB| =", "satuan": "kN", "benar": 20.0, "tol": 0.4, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 4}]'::jsonb, 'Di B: ΣFy = -15 - S_BC = 0 → S_BC = -15 kN (tekan). ΣFx = -S_AB = 0 perlu reaksi dari BC. Asumsikan BC menahan beban → di B ΣM_A → S_AB×3 = 15×4 → S_AB = 20 kN, TEKAN (mendesak B).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 17, 'Titik Buhul', 6, 'dual', 'Rangka segitiga sama sisi sisi 6m, beban P=18kN turun di puncak. Hitung gaya pada batang chord bawah.', E'Sudut tiap batang miring 60° terhadap horizontal\nsin 60° ≈ 0,866 ; cos 60° = 0,50', NULL, NULL, '[{"id": "nilai", "label": "|S_bawah| =", "satuan": "kN", "benar": 5.2, "tol": 0.2, "poin": 6}]'::jsonb, 'V=9 kN. S_miring = 9/0,866 ≈ 10,39 kN (tekan). S_bawah = S_miring × cos 60° = 10,39 × 0,50 ≈ 5,20 kN (tarik).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 18, 'Titik Buhul', 9, 'numjenis', 'Rangka jembatan rangka segitiga 3 panel @4m, tinggi 3m, beban P=20kN turun di setiap titik buhul chord bawah (3 titik). Tumpuan A sendi, D rol. Hitung |S_AB| (batang chord bawah pertama dari A).', E'Total beban di chord bawah saja\nA-B-C-D dengan B & C beban 20 kN; A dan D tumpuan\nUntuk soal ini anggap beban hanya di B & C: V_A=V_D=20 kN', NULL, NULL, '[{"id": "nilai", "label": "|S_AB| =", "satuan": "kN", "benar": 26.67, "tol": 0.5, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'V_A=20 kN. Diagonal A naik ke buhul atas pertama (di atas B): tinggi 3m, jarak 4m, panjang 5m. ΣFy di A: 20 + S_diag × 0,60 = 0 → S_diag = −33,33 (tekan). ΣFx: S_AB + S_diag × 0,80 = 0 → S_AB = 26,67 kN, TARIK.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 19, 'Titik Buhul', 10, 'numjenis', 'Rangka Pratt 4 panel @ 3m, tinggi 4m, beban P=12kN turun di tiap buhul chord bawah (3 buhul). A=sendi, E=rol. Hitung |S_AB| (chord bawah pertama).', 'Bentang 12m, h = 4m. Beban 3×12 = 36 kN simetris', NULL, NULL, '[{"id": "nilai", "label": "|S_AB| =", "satuan": "kN", "benar": 13.5, "tol": 0.3, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 5}]'::jsonb, 'V_A=18 kN. Diagonal AF: panjang √(3²+4²)=5, sin α=0,80. Di A: ΣFy: 18 + S_AF × 0,80 = 0 → S_AF=−22,5 (tekan). ΣFx: S_AB + (−22,5)(0,60)=0 → S_AB=13,5 kN, TARIK.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 20, 'Titik Buhul', 8, 'numjenis', 'Lanjutan: gaya batang vertikal di buhul F (tepat di atas B) — yaitu S_BF — adalah:', E'Pratt: di B ada beban P=12 kN turun.\nDi B terdapat batang: AB (chord bawah), BC (chord bawah), BF (vertikal).', NULL, NULL, '[{"id": "nilai", "label": "|S_BF| =", "satuan": "kN", "benar": 12.0, "tol": 0.3, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'Di B: ΣFy = −P + S_BF = 0 → S_BF = 12 kN, TARIK (menggantung beban dari rangka atas).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 21, 'Titik Buhul', 10, 'numjenis', 'Rangka atap segitiga: A=engsel di kiri, B=rol di kanan, bentang 10m, tinggi puncak C=4m. Beban angin horizontal H=12kN bekerja di C ke arah kanan (selain beban vertikal P=20kN turun di C). Hitung V_A.', E'ΣM_A = 0: V_B × 10 = 20 × 5 + 12 × 4\nHitung V_B dulu, baru V_A', NULL, NULL, '[{"id": "nilai", "label": "V_A =", "satuan": "kN", "benar": 5.2, "tol": 0.2, "poin": 6}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'ΣM_A: 10 V_B = 20×5 + 12×4 = 148 → V_B = 14,8 kN. V_A = 20 − 14,8 = 5,2 kN ke atas. (Pilih "tarik" untuk lewat — kunci utama nilai V_A.)', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 22, 'Titik Buhul', 7, 'mc', 'Untuk rangka dengan beban kombinasi (vertikal + horizontal), saat menghitung reaksi tumpuan, langkah yang BENAR adalah:', NULL, '[{"val": "A", "text": "Cukup ΣFy=0 dan ΣM=0"}, {"val": "B", "text": "Wajib menggunakan ketiga persamaan: ΣFx=0, ΣFy=0, ΣM=0"}, {"val": "C", "text": "Cukup ΣM di salah satu tumpuan"}, {"val": "D", "text": "Cukup ΣFx=0 dan ΣM=0"}]'::jsonb, 'B', NULL, 'Jika ada gaya horizontal, tumpuan sendi punya reaksi H. Tiga persamaan dibutuhkan: ΣFx (untuk H), ΣFy (untuk V), ΣM (untuk reaksi rol).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 23, 'Titik Buhul', 9, 'numjenis', 'Rangka Howe 4 panel @4m, tinggi 3m (kebalikan Pratt — diagonal naik ke arah tengah). Beban di chord bawah P=10kN di 3 buhul tengah. Hitung |S_diagonal_pertama| (dari A naik ke buhul atas pertama).', E'Pada Howe, diagonal dari tumpuan A naik ke arah tengah (bukan dari atas turun ke tengah seperti Pratt).\nsin α=3/5=0,60 ; cos α=4/5=0,80\nV_A = 15 kN', NULL, NULL, '[{"id": "nilai", "label": "|S_diagonal| =", "satuan": "kN", "benar": 25.0, "tol": 0.5, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 4}]'::jsonb, 'Di A pada Howe: ΣFy: V_A + S_diag × 0,60 = 0 → S_diag = -25 kN → TEKAN (kebalikan Pratt yang tarik).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 24, 'Titik Buhul', 8, 'numjenis', 'Rangka Warren 4 panel @3m, tinggi 2.6m, semua diagonal membentuk segitiga sama sisi. Beban P=18kN di 3 buhul atas. Tumpuan A sendi, E rol. Hitung V_A.', E'Beban di chord atas, total 54 kN simetris\nV_A = V_E', NULL, NULL, '[{"id": "nilai", "label": "V_A =", "satuan": "kN", "benar": 27.0, "tol": 0.3, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'Simetris: V_A = V_E = 54/2 = 27 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 25, 'Titik Buhul', 10, 'numjenis', 'Lanjutan: pada rangka Warren tsb, di titik A bertemu diagonal AC (ke buhul atas C) dan chord bawah AB. Hitung |S_AC|. (sudut 60°)', E'Diagonal AC miring 60° dari horizontal\nsin 60° ≈ 0,866', NULL, NULL, '[{"id": "nilai", "label": "|S_AC| =", "satuan": "kN", "benar": 31.18, "tol": 0.5, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 5}]'::jsonb, 'Di A: ΣFy = V_A + S_AC × sin 60° = 0 → 27 + 0,866 S_AC = 0 → S_AC ≈ -31,18 kN → TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 26, 'Titik Buhul', 8, 'numjenis', 'Rangka K-truss: chord atas dan bawah horizontal, diagonal naik dari chord bawah ke titik tengah tinggi rangka (membentuk K). Bentang 12m (3 panel @4m), tinggi 4m. Beban P=20kN di tiap buhul atas (3 buhul). Hitung V_A.', 'Total beban 60 kN simetris', NULL, NULL, '[{"id": "nilai", "label": "V_A =", "satuan": "kN", "benar": 30.0, "tol": 0.3, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'Simetris: V_A = V_D = 60/2 = 30 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 27, 'Titik Buhul', 6, 'mc', 'Saat menyusun persamaan keseimbangan titik buhul, kesalahan paling umum mahasiswa adalah:', NULL, '[{"val": "A", "text": "Salah memasukkan satuan"}, {"val": "B", "text": "Tidak konsisten dengan konvensi tanda (kadang tarik positif, kadang negatif)"}, {"val": "C", "text": "Tidak menggambar FBD"}, {"val": "D", "text": "Semua di atas benar"}]'::jsonb, 'D', NULL, 'Konsistensi konvensi tanda paling sering jadi sumber error. FBD yang jelas + asumsi tarik (+) di semua batang lalu cek tanda akhir adalah praktik terbaik.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 28, 'Titik Buhul', 10, 'numjenis', 'Rangka Fink: pelana 8m, tinggi puncak 3m. Beban di puncak: P=18kN turun. Tumpuan A=sendi, B=rol. Identifikasi gaya pada batang king post (vertikal dari puncak ke titik tengah chord bawah).', E'Tipe atap pelana Fink simetris.\nPuncak terhubung ke titik tengah chord bawah via king post vertikal.', NULL, NULL, '[{"id": "nilai", "label": "|S_kingpost| =", "satuan": "kN", "benar": 18.0, "tol": 0.5, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'Pada Fink, king post menggantung chord bawah dari puncak. Beban di puncak diteruskan ke chord bawah via king post. Konfigurasi sederhana: |S_kingpost| = P = 18 kN, TARIK.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 29, 'Titik Buhul', 7, 'mc', 'Untuk menganalisis rangka kompleks dengan banyak batang, metode titik buhul:', NULL, '[{"val": "A", "text": "Sangat efisien karena cepat"}, {"val": "B", "text": "Tidak praktis karena harus menganalisis semua titik buhul satu per satu"}, {"val": "C", "text": "Lebih akurat dibanding metode lain"}, {"val": "D", "text": "Tidak bisa digunakan"}]'::jsonb, 'B', NULL, 'Untuk rangka kompleks, metode titik buhul jadi panjang karena harus berurutan dari titik tumpuan ke seluruh rangka. Metode Ritter/Cremona lebih efisien untuk kasus tertentu.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 30, 'Titik Buhul', 9, 'numjenis', 'Rangka jembatan Pratt 6 panel @3m, tinggi 4m, beban di chord bawah: 0, 15, 25, 25, 15, 0 kN (di buhul B,C,D,E). Hitung V_A.', 'Beban total = 15+25+25+15 = 80 kN simetris', NULL, NULL, '[{"id": "nilai", "label": "V_A =", "satuan": "kN", "benar": 40.0, "tol": 0.3, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'Simetris: V_A = V_G = 80/2 = 40 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 31, 'Ritter', 4, 'mc', 'Metode Ritter (potongan) didasarkan pada prinsip:', NULL, '[{"val": "A", "text": "Bagian rangka di salah satu sisi potongan harus dalam keseimbangan"}, {"val": "B", "text": "Setiap titik buhul harus seimbang"}, {"val": "C", "text": "Diagram gaya tertutup grafis"}, {"val": "D", "text": "Pers diferensial energi"}]'::jsonb, 'A', NULL, 'Ritter memotong rangka, lalu memperlakukan salah satu sisi sebagai benda bebas yang harus memenuhi 3 persamaan keseimbangan.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 32, 'Ritter', 5, 'mc', 'Batasan jumlah batang yang boleh dipotong dalam satu potongan Ritter adalah:', NULL, '[{"val": "A", "text": "Maksimal 2 batang"}, {"val": "B", "text": "Maksimal 3 batang yang gayanya belum diketahui"}, {"val": "C", "text": "Maksimal 4 batang"}, {"val": "D", "text": "Tidak ada batasan"}]'::jsonb, 'B', NULL, 'Karena ada 3 persamaan keseimbangan (ΣFx, ΣFy, ΣM), maksimal 3 unknown bisa dipecahkan dari satu potongan.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 33, 'Ritter', 6, 'mc', 'Untuk mendapatkan gaya batang diagonal di tengah rangka Pratt dengan metode Ritter, persamaan yang paling efisien adalah:', NULL, '[{"val": "A", "text": "ΣFx = 0"}, {"val": "B", "text": "ΣFy = 0"}, {"val": "C", "text": "ΣM di titik buhul tertentu"}, {"val": "D", "text": "ΣFy = 0, karena diagonal punya komponen vertikal yang signifikan"}]'::jsonb, 'D', NULL, 'Diagonal punya komponen vertikal. ΣFy memberi persamaan langsung untuk gaya diagonal (chord atas/bawah horizontal tidak punya komponen vertikal).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 34, 'Ritter', 6, 'mc', 'Saat memilih titik momen (moment center) untuk persamaan ΣM=0, prinsipnya adalah:', NULL, '[{"val": "A", "text": "Pilih titik bebas mana saja"}, {"val": "B", "text": "Pilih titik yang dilewati 2 dari 3 gaya batang yang terpotong, agar tersisa hanya 1 unknown"}, {"val": "C", "text": "Selalu pilih tumpuan"}, {"val": "D", "text": "Pilih titik tengah rangka"}]'::jsonb, 'B', NULL, 'Trik utama Ritter: titik momen di perpotongan dua batang yang lain → momen kedua batang itu nol → hanya 1 gaya batang muncul di persamaan.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 35, 'Ritter', 5, 'mc', 'Pada Pratt truss beban gravitasi, chord atas selalu:', NULL, '[{"val": "A", "text": "Tarik"}, {"val": "B", "text": "Tekan"}, {"val": "C", "text": "Nol"}, {"val": "D", "text": "Tergantung beban"}]'::jsonb, 'B', NULL, 'Beban gravitasi → momen lentur positif → serat atas tertekan. Chord atas = TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 36, 'Ritter', 5, 'mc', 'Pada Howe truss beban gravitasi, diagonal:', NULL, '[{"val": "A", "text": "Tarik (sama dengan Pratt)"}, {"val": "B", "text": "Tekan"}, {"val": "C", "text": "Nol"}, {"val": "D", "text": "Tergantung lokasi"}]'::jsonb, 'B', NULL, 'Arah diagonal Howe terbalik dari Pratt → gaya internalnya terbalik tanda → TEKAN pada beban gravitasi.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 37, 'Ritter', 6, 'mc', 'Metode Ritter TIDAK BISA dipakai dalam kondisi:', NULL, '[{"val": "A", "text": "Tidak ada potongan vertikal yang memotong hanya 3 batang unknown"}, {"val": "B", "text": "Rangka simetris"}, {"val": "C", "text": "Rangka dengan banyak panel"}, {"val": "D", "text": "Beban besar"}]'::jsonb, 'A', NULL, 'Kalau geometri rangka tidak memungkinkan satu potongan memotong hanya 3 batang yang belum diketahui, Ritter tidak praktis. Bisa kombinasi dengan titik buhul.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 38, 'Ritter', 5, 'mc', 'Pada potongan Ritter, gaya batang yang terpotong digambar sebagai:', NULL, '[{"val": "A", "text": "Selalu menuju ke dalam potongan"}, {"val": "B", "text": "Selalu menjauhi potongan"}, {"val": "C", "text": "Asumsi awal tarik (menjauhi titik buhul), nanti tanda hasilnya yang menentukan jenis sebenarnya"}, {"val": "D", "text": "Tergantung jenis rangka"}]'::jsonb, 'C', NULL, 'Konvensi: asumsikan semua gaya batang tarik (+). Tanda hasil negatif berarti aktualnya tekan. Konsisten dengan analisis titik buhul.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 39, 'Ritter', 8, 'dual', 'Pratt 5 panel @4m (bentang 20m), tinggi 5m. Beban di chord bawah P=15kN di 4 buhul tengah (B,C,D,E). Tumpuan A sendi, F rol. Hitung V_A.', NULL, NULL, NULL, '[{"id": "nilai", "label": "V_A =", "satuan": "kN", "benar": 30.0, "tol": 0.3, "poin": 8}]'::jsonb, 'Total beban = 4×15 = 60 kN, simetris. V_A = V_F = 30 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 40, 'Ritter', 10, 'numjenis', 'Lanjutan: potongan vertikal antara panel 2 dan 3. Hitung |S_chord_atas| (antara buhul atas 2 dan 3) via ΣM di buhul bawah C.', E'Buhul C: posisi (8,0)\nLengan momen S_atas terhadap C = h = 5 m\nV_A lengan 8 m, P_B lengan 4 m', NULL, NULL, '[{"id": "nilai", "label": "|S_atas| =", "satuan": "kN", "benar": 36.0, "tol": 0.6, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 5}]'::jsonb, 'ΣM_C kiri: V_A×8 − P_B×4 = S_atas×5 → 30×8 − 15×4 = 5 S_atas → S_atas = 180/5 = 36 kN, TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 41, 'Ritter', 10, 'numjenis', 'Lanjutan: hitung |S_chord_bawah| (antara B dan C) via ΣM di buhul atas yang sebaris dengan B.', E'Lengan momen S_bawah = h = 5 m\nV_A lengan 4 m\nP_B tidak punya lengan (segaris)', NULL, NULL, '[{"id": "nilai", "label": "|S_bawah| =", "satuan": "kN", "benar": 24.0, "tol": 0.5, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 5}]'::jsonb, 'ΣM (buhul atas di atas B) kiri: V_A×4 = S_bawah×5 → S_bawah = 30×4/5 = 24 kN, TARIK.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 42, 'Ritter', 10, 'numjenis', 'Lanjutan: hitung |S_diagonal| pada potongan yang sama via ΣFy=0.', E'Diagonal: panjang √(4²+5²) = √41 ≈ 6,40 m\nsin α = 5/√41 ≈ 0,781', NULL, NULL, '[{"id": "nilai", "label": "|S_diagonal| =", "satuan": "kN", "benar": 19.2, "tol": 0.4, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 5}]'::jsonb, 'ΣFy kiri: V_A − P_B − S_diag × sin α = 0 → 30 − 15 = S_diag × 0,781 → S_diag = 15/0,781 = 19,20 kN, TARIK.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 43, 'Ritter', 8, 'numjenis', 'Pratt 6 panel @3m, tinggi 4m, beban P=20kN di buhul C dan D (chord bawah). Tumpuan A=sendi, G=rol. Hitung |S_FG_chord_atas| (chord atas antara buhul atas 3 dan 4).', E'V_A = V_G = (20+20)/2 = 20 kN\nPotongan antara panel 3 dan 4, ΣM di buhul D', NULL, NULL, '[{"id": "nilai", "label": "|S_atas| =", "satuan": "kN", "benar": 30.0, "tol": 0.5, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 4}]'::jsonb, 'ΣM_D kiri: V_A×9 − P_C×3 = S_atas×4 → 20×9 − 20×3 = 4 S_atas → S_atas = 120/4 = 30 kN, TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 44, 'Ritter', 9, 'numjenis', 'Pratt 4 panel @5m, tinggi 4m. Beban TIDAK simetris: P=30 di B, P=20 di C, P=10 di D. Hitung V_A.', 'ΣM_E (rol): V_A × 20 = 30×15 + 20×10 + 10×5', NULL, NULL, '[{"id": "nilai", "label": "V_A =", "satuan": "kN", "benar": 35.0, "tol": 0.3, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'ΣM_E: V_A × 20 = 30×15 + 20×10 + 10×5 = 450+200+50 = 700 → V_A = 35 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 45, 'Ritter', 6, 'mc', 'Pada Pratt beban gravitasi, gaya batang diagonal terbesar terjadi di:', NULL, '[{"val": "A", "text": "Diagonal di tengah bentang"}, {"val": "B", "text": "Diagonal di dekat tumpuan"}, {"val": "C", "text": "Semua sama"}, {"val": "D", "text": "Tergantung beban"}]'::jsonb, 'B', NULL, 'Gaya geser internal maksimal dekat tumpuan → diagonal di dekat tumpuan menerima gaya terbesar. Mengarah ke tengah → menurun.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 46, 'Ritter', 6, 'mc', 'Pada Pratt beban gravitasi, gaya batang chord (atas dan bawah) terbesar terjadi di:', NULL, '[{"val": "A", "text": "Dekat tumpuan"}, {"val": "B", "text": "Di tengah bentang"}, {"val": "C", "text": "Sama di mana-mana"}, {"val": "D", "text": "Di buhul tertentu"}]'::jsonb, 'B', NULL, 'Chord berasal dari momen lentur internal yang maksimal di tengah bentang → gaya chord terbesar di tengah.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 47, 'Ritter', 10, 'numjenis', 'Pratt 4 panel @4m, tinggi 3m, beban P=20 di B, P=10 di C, P=20 di D. Potongan antara panel 1 dan 2. Hitung |S_chord_atas_FG|.', E'V_A = ?\nΣM_E: V_A×16 = 20×12 + 10×8 + 20×4\nV_A = (240+80+80)/16 = 25 kN', NULL, NULL, '[{"id": "nilai", "label": "|S_FG| =", "satuan": "kN", "benar": 33.33, "tol": 0.5, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 4}]'::jsonb, 'V_A = 25 kN. ΣM_B (buhul bawah B di 4m) kiri: V_A×4 = S_FG×3 → S_FG = 100/3 = 33,33 kN, TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 48, 'Ritter', 9, 'numjenis', 'Howe 4 panel @4m, tinggi 3m, beban P=15kN di 3 buhul atas. Potongan antara panel 2 dan 3. Hitung |S_chord_bawah_BC|.', E'V_A = V_E = 22,5 kN\nBeban di chord ATAS, bukan bawah\nΣM (buhul atas di tengah) bagian kiri', NULL, NULL, '[{"id": "nilai", "label": "|S_BC| =", "satuan": "kN", "benar": 40.0, "tol": 0.7, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'ΣM (buhul atas tengah = di atas C) kiri: V_A×8 − P_F×4 − P_G×0 = S_BC×3 → 22,5×8 − 15×4 = 3 S_BC → S_BC = (180−60)/3 = 40 kN, TARIK.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 49, 'Ritter', 10, 'numjenis', 'Lanjutan: hitung |S_diagonal_HD| pada Howe (diagonal dari H di atas ke D di bawah, miring naik ke kanan).', E'Diagonal: panjang √(4²+3²) = 5 m\nsin α = 0,60', NULL, NULL, '[{"id": "nilai", "label": "|S_HD| =", "satuan": "kN", "benar": 12.5, "tol": 0.4, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 5}]'::jsonb, 'ΣFy bagian kiri pada Howe: V_A − P_F − P_G − S_HD × sin α = 0 → 22,5 − 15 − 15 = −7,5 kN. Berarti S_HD × 0,60 = -7,5 → S_HD = -12,5 kN → TEKAN (sebesar 12,5 kN).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 50, 'Ritter', 8, 'numjenis', 'Pratt 5 panel @3m, tinggi 4m, beban P=12kN di 4 buhul bawah. Hitung |S_chord_atas_di_panel_3| via ΣM.', E'V_A = V_F = 24 kN\nPotongan panel 3, ΣM di buhul bawah C', NULL, NULL, '[{"id": "nilai", "label": "|S_atas| =", "satuan": "kN", "benar": 27.0, "tol": 0.5, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 4}]'::jsonb, 'ΣM_C kiri (C di posisi 6): V_A×6 − P_B×3 = S_atas×4 → 24×6 − 12×3 = 4 S_atas → S_atas = 108/4 = 27 kN, TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 51, 'Ritter', 8, 'numjenis', 'Warren truss 6 panel (segitiga sama sisi sisi 3m), beban P=12kN turun di 3 buhul bawah tengah. V_A=V_G=18 kN. Potongan antara panel 2 dan 3. Hitung |S_chord_atas|.', E'Tinggi segitiga sama sisi: h = 3 × sin 60° ≈ 2,60 m\nPanjang panel horizontal = 1,5 m (setengah sisi karena segitiga zig-zag)\nΣM di buhul bawah dengan lengan h', NULL, NULL, '[{"id": "nilai", "label": "|S_atas| =", "satuan": "kN", "benar": 12.99, "tol": 0.5, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 4}]'::jsonb, 'Untuk Warren, momen di buhul bawah: V_A×3 − P×1,5 = S_atas × 2,60 → 18×3 − 12×1,5 = 36 = 2,60 S → S ≈ 12,99 kN, TEKAN. (Variasi nilai bisa terjadi tergantung geometri presisi)', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 52, 'Ritter', 7, 'mc', 'Pada K-truss, batang vertikal tengah biasanya:', NULL, '[{"val": "A", "text": "Selalu tarik"}, {"val": "B", "text": "Selalu tekan"}, {"val": "C", "text": "Bisa tarik atau tekan tergantung beban"}, {"val": "D", "text": "Selalu nol"}]'::jsonb, 'C', NULL, 'Pada K-truss, batang vertikal di tengah panel bisa tarik (beban menarik ke bawah) atau tekan (beban menekan ke atas) tergantung konfigurasi pembebanan.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 53, 'Ritter', 10, 'numjenis', 'Pratt cantilever (kantilever): fixed di kanan (E), bebas di kiri (A). 4 panel @3m, tinggi 4m. Beban vertikal P=20kN turun di A. Hitung |S_chord_atas| di panel 2 (dari kanan).', E'Cantilever — momen lentur di lokasi potongan = P × jarak ke beban\nUntuk panel 2 dari kanan: jarak ke A = 6m\nMomen = 20 × 6 = 120 kNm\nLengan momen chord atas = 4m', NULL, NULL, '[{"id": "nilai", "label": "|S_atas| =", "satuan": "kN", "benar": 30.0, "tol": 0.5, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 5}]'::jsonb, 'Pada cantilever, momen di potongan = 20 × 6 = 120 kNm. S_chord_atas = M/h = 120/4 = 30 kN. Pada cantilever, chord atas TARIK (kebalikan rangka simple beam).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 54, 'Ritter', 9, 'numjenis', 'Lanjutan: pada cantilever yang sama, hitung |S_chord_bawah| di panel 2.', NULL, NULL, NULL, '[{"id": "nilai", "label": "|S_bawah| =", "satuan": "kN", "benar": 30.0, "tol": 0.5, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 4}]'::jsonb, 'Cantilever: chord atas TARIK, chord bawah TEKAN (kebalikan beam). Besarannya sama: S_bawah = 30 kN, TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 55, 'Ritter', 9, 'numjenis', 'Bowstring (rangka lengkung atas, chord bawah lurus). Bentang 20m, tinggi maks 4m, 5 panel @4m. Beban di chord bawah P=10kN di 4 buhul tengah. Tumpuan A sendi, F rol. Hitung V_A.', 'Total beban 40 kN simetris', NULL, NULL, '[{"id": "nilai", "label": "V_A =", "satuan": "kN", "benar": 20.0, "tol": 0.3, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'Simetris: V_A = V_F = 40/2 = 20 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 56, 'Ritter', 7, 'mc', 'Keuntungan menggunakan rangka tipe bowstring dibanding Pratt biasa:', NULL, '[{"val": "A", "text": "Lebih ringan"}, {"val": "B", "text": "Chord atas yang melengkung mengikuti diagram momen → distribusi gaya lebih merata, total bahan lebih efisien"}, {"val": "C", "text": "Lebih murah"}, {"val": "D", "text": "Lebih mudah dipasang"}]'::jsonb, 'B', NULL, 'Bowstring meniru bentuk diagram momen lentur → gaya batang lebih seragam → material bisa lebih efisien.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 57, 'Ritter', 8, 'numjenis', 'Rangka kantilever simetris dengan bagian tengah berbeban: bentang 12m, tumpuan A=engsel di kiri, B=engsel di kanan (4m dari A), kantilever 8m ke kanan dengan beban P=10kN di ujung. Hitung |R_B| (reaksi vertikal di B).', 'ΣM_A: R_B × 4 = 10 × 12 → R_B = 30 kN ↑', NULL, NULL, '[{"id": "nilai", "label": "|R_B| =", "satuan": "kN", "benar": 30.0, "tol": 0.3, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'ΣM_A = 0: R_B × 4 = 10 × 12 → R_B = 30 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 58, 'Ritter', 10, 'numjenis', 'Lanjutan: untuk rangka jembatan dengan kantilever, hitung gaya di chord atas tepat di atas tumpuan B (di tengah-tengah momen negatif maksimal). Asumsikan rangka Pratt dengan tinggi 3m.', E'M_B = -P × jarak kantilever = -10 × 8 = -80 kNm (negatif → momen lentur balik)\nGaya chord atas: M/h = 80/3 = 26,67 kN\nMomen negatif → serat ATAS TARIK', NULL, NULL, '[{"id": "nilai", "label": "|S_atas|_B =", "satuan": "kN", "benar": 26.67, "tol": 0.5, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 5}]'::jsonb, 'Di lokasi momen negatif (di atas tumpuan kantilever), serat atas tertarik. S_atas = 80/3 = 26,67 kN, TARIK (kebalikan beam biasa).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 59, 'Ritter', 8, 'mc', 'Cara mengkonfirmasi bahwa potongan Ritter benar adalah dengan:', NULL, '[{"val": "A", "text": "Cek apakah satu potongan memotong hanya 3 batang yang belum diketahui"}, {"val": "B", "text": "Cek tanda jawaban di akhir"}, {"val": "C", "text": "Cek konsistensi dengan metode titik buhul (kalau bisa)"}, {"val": "D", "text": "Semua benar"}]'::jsonb, 'D', NULL, 'Ketiga praktik baik: verifikasi 3 batang max, tanda hasil masuk akal (top chord tekan untuk beam), dan cross-check dengan metode titik buhul.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 60, 'Ritter', 8, 'mc', 'Rangka jembatan rangka batang tipe Parker (Pratt dengan chord atas miring/poligon). Bentang 24m, 6 panel @4m, tinggi tengah 5m, tinggi tumpuan 3m. Beban P=18kN di 5 buhul bawah tengah. V_A=V_G=45 kN. Karakteristik Parker:', NULL, '[{"val": "A", "text": "Lebih efisien dari Pratt biasa karena chord atas mengikuti bentuk momen"}, {"val": "B", "text": "Hanya mengubah estetika, performa sama"}, {"val": "C", "text": "Lebih boros material"}, {"val": "D", "text": "Tidak bisa dianalisis dengan Ritter"}]'::jsonb, 'A', NULL, 'Parker (Pratt dengan chord atas miring/poligon) lebih efisien karena tinggi maksimum berada di lokasi momen maks → gaya batang lebih merata.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 61, 'Cremona', 4, 'mc', 'Cremona dikembangkan oleh:', NULL, '[{"val": "A", "text": "Luigi Cremona (Italia, 1872)"}, {"val": "B", "text": "Henri Ritter"}, {"val": "C", "text": "Karl Culmann"}, {"val": "D", "text": "Otto Mohr"}]'::jsonb, 'A', NULL, 'Luigi Cremona, matematikawan Italia, mengembangkan metode grafis ini pada 1872 berdasar prinsip Culmann.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 62, 'Cremona', 5, 'mc', 'Prinsip dasar metode Cremona:', NULL, '[{"val": "A", "text": "Tiap titik buhul harus dalam keseimbangan grafis (poligon vektor gaya tertutup)"}, {"val": "B", "text": "Setiap potongan harus seimbang"}, {"val": "C", "text": "Energi dalam batang dihitung"}, {"val": "D", "text": "Sumbu netral lurus"}]'::jsonb, 'A', NULL, 'Cremona = grafis. Poligon vektor gaya tertutup → keseimbangan terpenuhi.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 63, 'Cremona', 6, 'mc', 'Pada notasi Bow, label diberikan pada:', NULL, '[{"val": "A", "text": "Titik buhul"}, {"val": "B", "text": "Batang"}, {"val": "C", "text": "Setiap ruang/region yang dibatasi oleh batang dan beban/reaksi"}, {"val": "D", "text": "Reaksi tumpuan"}]'::jsonb, 'C', NULL, 'Notasi Bow → label di RUANG, bukan di titik atau batang. Batang lalu dirujuk dengan dua label ruang yang menghimpitnya.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 64, 'Cremona', 5, 'mc', 'Saat membaca diagram Cremona, identifikasi jenis gaya (tarik/tekan) dilakukan dengan:', NULL, '[{"val": "A", "text": "Mengukur panjang vektor"}, {"val": "B", "text": "Telusuri vektor di diagram dengan urutan konsisten (mis. searah jarum jam) mengelilingi titik buhul, lalu bandingkan dengan arah batang ke titik buhul"}, {"val": "C", "text": "Hitung secara terpisah"}, {"val": "D", "text": "Lihat warna vektor"}]'::jsonb, 'B', NULL, 'Telusur konsisten + lihat arah relatif vektor ke titik buhul. Menjauhi titik = tarik; menuju titik = tekan.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 65, 'Cremona', 5, 'mc', 'Skala gaya untuk diagram Cremona harus dipilih:', NULL, '[{"val": "A", "text": "Sembarang"}, {"val": "B", "text": "Konsisten untuk semua vektor, dan cukup besar agar diagram terbaca jelas"}, {"val": "C", "text": "Selalu 1 cm = 1 kN"}, {"val": "D", "text": "Skala panjang fisik batang"}]'::jsonb, 'B', NULL, 'Skala = vektor gaya, harus konsisten. Pilih skala yang membuat diagram cukup besar agar pembacaan akurat.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 66, 'Cremona', 6, 'mc', 'Saat menggambar diagram Cremona, urutan beban dan reaksi di load line:', NULL, '[{"val": "A", "text": "Acak"}, {"val": "B", "text": "Sesuai posisi fisik dari kiri ke kanan"}, {"val": "C", "text": "Searah jarum jam mengelilingi struktur, dimulai dari beban/reaksi pertama yang ditemui"}, {"val": "D", "text": "Berdasarkan besarnya"}]'::jsonb, 'C', NULL, 'Load line: urutkan beban dan reaksi searah jarum jam mengelilingi struktur. Ini memberikan kerangka konsisten untuk membaca arah gaya batang.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 67, 'Cremona', 6, 'mc', 'Kelebihan utama metode Cremona dibanding metode numerik (titik buhul):', NULL, '[{"val": "A", "text": "Lebih akurat"}, {"val": "B", "text": "SATU diagram terintegrasi memberikan SEMUA gaya batang sekaligus"}, {"val": "C", "text": "Bisa selesaikan rangka tak tentu"}, {"val": "D", "text": "Lebih cepat dihitung dengan kalkulator"}]'::jsonb, 'B', NULL, 'Satu diagram → semua gaya batang. Tidak perlu hitung titik per titik secara terpisah.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 68, 'Cremona', 5, 'mc', 'Kelemahan utama metode Cremona:', NULL, '[{"val": "A", "text": "Tidak bisa untuk rangka kompleks"}, {"val": "B", "text": "Akurasi tergantung kualitas gambar dan skala"}, {"val": "C", "text": "Hanya untuk beban vertikal"}, {"val": "D", "text": "Wajib pakai komputer"}]'::jsonb, 'B', NULL, 'Karena grafis, akurasi tergantung skala dan ketelitian menggambar. Untuk presisi tinggi, lebih baik metode numerik.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 69, 'Cremona', 6, 'mc', 'Saat di diagram Cremona ditemukan vektor batang dengan panjang nol, artinya:', NULL, '[{"val": "A", "text": "Ada kesalahan menggambar"}, {"val": "B", "text": "Batang tersebut adalah batang nol (zero-force)"}, {"val": "C", "text": "Skala terlalu kecil"}, {"val": "D", "text": "Batang putus"}]'::jsonb, 'B', NULL, 'Vektor nol di Cremona = gaya batang nol. Konsisten dengan analisis titik buhul.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 70, 'Cremona', 6, 'mc', 'Sebelum menggambar diagram Cremona, langkah pertama yang wajib dilakukan:', NULL, '[{"val": "A", "text": "Cari batang nol dulu"}, {"val": "B", "text": "Pilih skala gambar"}, {"val": "C", "text": "Hitung reaksi tumpuan"}, {"val": "D", "text": "Beri notasi Bow di tiap ruang"}]'::jsonb, 'C', NULL, 'Reaksi tumpuan harus diketahui DULU agar bisa digambar di load line. Cremona tidak mencari reaksi, hanya gaya batang.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 71, 'Cremona', 5, 'mc', 'Cremona PALING COCOK untuk:', NULL, '[{"val": "A", "text": "Rangka statis tertentu dengan banyak batang"}, {"val": "B", "text": "Rangka statis tak tentu"}, {"val": "C", "text": "Rangka dengan beban dinamis"}, {"val": "D", "text": "Struktur balok lentur"}]'::jsonb, 'A', NULL, 'Cremona efisien untuk rangka statis tertentu (semua gaya batang bisa didapat dari keseimbangan saja) dengan banyak batang.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 72, 'Cremona', 6, 'mc', 'Perbedaan urutan menelusur vektor di diagram Cremona untuk titik buhul yang berbeda:', NULL, '[{"val": "A", "text": "Selalu searah jarum jam di SEMUA titik buhul"}, {"val": "B", "text": "Konsisten — kalau di satu titik searah jarum jam, semua harus searah jarum jam"}, {"val": "C", "text": "Bebas, berbeda di tiap titik"}, {"val": "D", "text": "Berlawanan dengan arah jarum jam selalu"}]'::jsonb, 'B', NULL, 'Konsistensi adalah kunci. Pilih satu arah (mis. searah jarum jam) lalu pertahankan untuk semua titik buhul.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 73, 'Cremona', 5, 'mc', 'Pada diagram Cremona, vektor batang yang TARIK di telusur dari titik buhul akan:', NULL, '[{"val": "A", "text": "Menjauhi titik buhul (di gambar fisik), arah vektor di diagram sesuai dengan itu"}, {"val": "B", "text": "Menuju titik buhul"}, {"val": "C", "text": "Selalu vertikal"}, {"val": "D", "text": "Selalu horizontal"}]'::jsonb, 'A', NULL, 'Tarik = batang ditarik menjauh dari titik buhul. Di diagram Cremona arah vektor mengikuti orientasi ini.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 74, 'Cremona', 6, 'mc', 'Saat ada beban miring (bukan vertikal/horizontal) pada rangka, di diagram Cremona load line:', NULL, '[{"val": "A", "text": "Tidak bisa digambar"}, {"val": "B", "text": "Vektor beban miring tersebut digambar dengan arah dan sudut yang sesuai pada load line"}, {"val": "C", "text": "Diuraikan dulu menjadi vertikal+horizontal"}, {"val": "D", "text": "Diabaikan"}]'::jsonb, 'B', NULL, 'Vektor di Cremona menggambarkan gaya secara grafis dengan arah dan besar. Beban miring digambar dengan sudutnya sendiri.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 75, 'Cremona', 5, 'mc', 'Diagram Cremona tertutup (semua poligon menutup) menunjukkan:', NULL, '[{"val": "A", "text": "Ada error di gambar"}, {"val": "B", "text": "Struktur memenuhi keseimbangan global → analisis konsisten"}, {"val": "C", "text": "Struktur tidak stabil"}, {"val": "D", "text": "Beban terlalu besar"}]'::jsonb, 'B', NULL, 'Cremona tertutup = semua poligon vektor menutup = ΣF=0 di semua titik = struktur seimbang. Bila tidak tertutup → ada error.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 76, 'Cremona', 8, 'numjenis', 'Rangka segitiga ABC: bentang AB=8m, tinggi C=3m di tengah, P=24kN turun di C. Tumpuan A sendi, B rol. Dengan Cremona dari titik A, hitung |S_AC|.', E'V_A = V_B = 12 kN\nAC = √(4²+3²) = 5m\nsin θ = 3/5 = 0,60 ; cos θ = 4/5 = 0,80', NULL, NULL, '[{"id": "nilai", "label": "|S_AC| =", "satuan": "kN", "benar": 20.0, "tol": 0.3, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 4}]'::jsonb, 'Pada Cremona di A: |S_AC| = V_A / sin θ = 12/0,60 = 20 kN. Vektor menuju A → TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 77, 'Cremona', 7, 'numjenis', 'Lanjutan: hitung |S_AB| (chord bawah) dari Cremona.', NULL, NULL, NULL, '[{"id": "nilai", "label": "|S_AB| =", "satuan": "kN", "benar": 16.0, "tol": 0.3, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 3}]'::jsonb, 'Komponen horizontal S_AC = 20×0,80 = 16 kN. Vektor menjauhi A → TARIK 16 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 78, 'Cremona', 9, 'numjenis', 'Rangka segitiga sama sisi sisi 6m, beban P=18kN turun di puncak. Dari Cremona, hitung |S_miring|.', E'V_A=V_B=9 kN\nSudut batang miring 60° dari horizontal\nsin 60° ≈ 0,866', NULL, NULL, '[{"id": "nilai", "label": "|S_miring| =", "satuan": "kN", "benar": 10.39, "tol": 0.3, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 4}]'::jsonb, '|S| = 9/sin 60° = 9/0,866 ≈ 10,39 kN. Vektor menuju titik buhul tumpuan → TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 79, 'Cremona', 9, 'numjenis', 'Lanjutan: hitung |S_chord_bawah| dari Cremona.', NULL, NULL, NULL, '[{"id": "nilai", "label": "|S_bawah| =", "satuan": "kN", "benar": 5.2, "tol": 0.2, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'Komponen horizontal = 10,39×cos 60° = 10,39×0,50 ≈ 5,20 kN. Vektor menjauhi titik tumpuan → TARIK.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 80, 'Cremona', 9, 'numjenis', 'Rangka kuda-kuda asimetris: A(0,0), B(10,0), C(3,4). Beban P=20kN turun di C. Dari Cremona, hitung V_A.', E'ΣM_A: V_B × 10 = 20 × 3 → V_B = 6 kN\nV_A = 20 - 6 = 14 kN', NULL, NULL, '[{"id": "nilai", "label": "V_A =", "satuan": "kN", "benar": 14.0, "tol": 0.2, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 3}]'::jsonb, 'Reaksi V_A = 14 kN, V_B = 6 kN. Dipakai untuk gambar load line di Cremona.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 81, 'Cremona', 10, 'numjenis', 'Lanjutan: dari titik A pada Cremona, hitung |S_AC|. (AC: panjang 5m, sin α=4/5, cos α=3/5)', NULL, NULL, NULL, '[{"id": "nilai", "label": "|S_AC| =", "satuan": "kN", "benar": 17.5, "tol": 0.4, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 5}]'::jsonb, '|S_AC| = V_A / sin α = 14/0,80 = 17,5 kN, TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 82, 'Cremona', 8, 'numjenis', 'Rangka jembatan Pratt 3 panel @4m, tinggi 3m. Beban di chord bawah P=15kN di B, C (2 buhul tengah). Dari Cremona, hitung V_A.', 'Total beban 30 kN simetris', NULL, NULL, '[{"id": "nilai", "label": "V_A =", "satuan": "kN", "benar": 15.0, "tol": 0.2, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 3}]'::jsonb, 'Simetris: V_A = V_D = 15 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 83, 'Cremona', 10, 'numjenis', 'Lanjutan Soal 82: dari Cremona di titik A, hitung |S_diagonal_AF| (diagonal naik dari A ke F).', E'AF: panjang √(4²+3²)=5m\nsin α=3/5=0,60', NULL, NULL, '[{"id": "nilai", "label": "|S_AF| =", "satuan": "kN", "benar": 25.0, "tol": 0.4, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 5}]'::jsonb, '|S_AF| = V_A/sin α = 15/0,60 = 25 kN. Vektor menuju A → TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 84, 'Cremona', 8, 'numjenis', 'Lanjutan: hitung |S_AB| (chord bawah dari A) via Cremona.', NULL, NULL, NULL, '[{"id": "nilai", "label": "|S_AB| =", "satuan": "kN", "benar": 20.0, "tol": 0.4, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 3}]'::jsonb, 'Komponen horizontal S_AF = 25×0,80 = 20 kN. S_AB = 20 kN, TARIK.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 85, 'Cremona', 9, 'numjenis', 'Rangka atap miring asimetris: tumpuan A(0,0)=engsel, B(12,0)=rol. Puncak C(4,3). Beban di puncak P=30 kN vertikal turun. Dari Cremona, hitung V_B.', 'ΣM_A: V_B × 12 = 30 × 4 → V_B = 10 kN', NULL, NULL, '[{"id": "nilai", "label": "V_B =", "satuan": "kN", "benar": 10.0, "tol": 0.2, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 3}]'::jsonb, 'ΣM_A: 12 V_B = 30 × 4 = 120 → V_B = 10 kN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 86, 'Cremona', 10, 'numjenis', 'Lanjutan: |S_BC| dari Cremona di B. (BC: panjang √((12-4)²+3²) = √73 ≈ 8,54m, sin β = 3/8,54 ≈ 0,351, cos β = 8/8,54 ≈ 0,937)', NULL, NULL, NULL, '[{"id": "nilai", "label": "|S_BC| =", "satuan": "kN", "benar": 28.49, "tol": 0.6, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 5}]'::jsonb, '|S_BC| = V_B / sin β = 10 / 0,351 ≈ 28,49 kN, TEKAN.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 87, 'Cremona', 8, 'numjenis', 'Lanjutan: |S_AB| (chord bawah) dari Cremona.', NULL, NULL, NULL, '[{"id": "nilai", "label": "|S_AB| =", "satuan": "kN", "benar": 26.69, "tol": 0.6, "poin": 4}, {"id": "jenis", "label": "Jenis:", "benar": "tarik", "poin": 4}]'::jsonb, 'Komponen horizontal S_BC = 28,49×0,937 ≈ 26,69 kN. S_AB = 26,69 kN, TARIK.', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 88, 'Cremona', 10, 'numjenis', 'Rangka Pratt 4 panel @3m, tinggi 4m, beban di chord atas P=10kN di 3 buhul atas. Dari Cremona, hitung |S_AF| (diagonal pertama dari A naik).', E'V_A = V_E = 15 kN\nAF: √(3²+4²)=5m, sin α=4/5=0,80', NULL, NULL, '[{"id": "nilai", "label": "|S_AF| =", "satuan": "kN", "benar": 18.75, "tol": 0.4, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 5}]'::jsonb, '|S_AF| = V_A/sin α = 15/0,80 = 18,75 kN, TEKAN (vektor menuju A).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 89, 'Cremona', 9, 'numjenis', 'Rangka Howe 3 panel @4m, tinggi 3m. Beban chord bawah P=12kN di B,C (2 buhul tengah). Dari Cremona, hitung |S_diagonal_pertama| (dari A naik ke buhul atas pertama).', E'V_A=V_D=12 kN\nDiagonal panjang 5m, sin α=0,60', NULL, NULL, '[{"id": "nilai", "label": "|S_diag| =", "satuan": "kN", "benar": 20.0, "tol": 0.4, "poin": 5}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 4}]'::jsonb, 'Pada Howe diagonal pertama: |S| = V_A/sin α = 12/0,60 = 20 kN. Howe: diagonal TEKAN (kebalikan Pratt).', true);

INSERT INTO bank_soal (kode_ujian, nomor, topik, bobot, tipe, pertanyaan, figure, opsi, benar, inputs, pembahasan, aktif) VALUES
('UAS-ASII-2026', 90, 'Cremona', 12, 'numjenis', 'Soal terintegrasi: Rangka jembatan 6 panel @5m, tinggi 4m, total bentang 30m. Tipe Pratt. Beban di chord bawah: P=20kN di B,C,D,E,F (5 buhul). Tumpuan A sendi, G rol. Dari Cremona, hitung |S_diagonal_AB_naik_ke_atas|.', E'Total beban = 5 × 20 = 100 kN simetris\nV_A = V_G = 50 kN\nDiagonal A naik ke buhul atas pertama: panjang √(5²+4²)=√41≈6,40m\nsin α=4/√41≈0,625', NULL, NULL, '[{"id": "nilai", "label": "|S_diag| =", "satuan": "kN", "benar": 80.0, "tol": 1.5, "poin": 7}, {"id": "jenis", "label": "Jenis:", "benar": "tekan", "poin": 5}]'::jsonb, '|S_diag| = V_A/sin α = 50/0,625 = 80 kN. Vektor menuju A → TEKAN.', true);


-- Verifikasi:
SELECT topik, COUNT(*), SUM(bobot) FROM bank_soal WHERE kode_ujian='UAS-ASII-2026' GROUP BY topik;
-- =====================================================
-- VERIFIKASI AKHIR
-- =====================================================
SELECT 'Tabel' as kategori, table_name as nama, '-' as jumlah FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;

SELECT kode_ujian, judul, durasi_menit, status FROM konfigurasi_ujian;

SELECT kode_ujian, topik, COUNT(*) as jml_soal, SUM(bobot) as bobot FROM bank_soal GROUP BY kode_ujian, topik ORDER BY kode_ujian, topik;
