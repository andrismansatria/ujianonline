# 🎓 Ujian Teknik Sipil — Universitas Teuku Umar

Sistem ujian online untuk Prodi Teknik Sipil Fakultas Teknik UTU.

## ✨ Fitur

- 📚 Multi mata kuliah (UTS, UAS, Kuis dalam satu sistem)
- ⏱️ Timer hitung mundur persistent (tahan refresh)
- 🎲 Soal & pilihan ganda diacak otomatis per mahasiswa
- 🔒 1 NIM = 1× kesempatan per ujian
- 🚨 Auto-submit saat waktu habis
- ⚠️ Deteksi pindah tab + catat di database
- 📂 Import bank soal via CSV
- 📊 Dashboard dosen dengan statistik & export CSV

## 🚀 Cara Deploy ke GitHub + Vercel

### Langkah 1: Hapus Repository GitHub Lama (opsional)

1. Buka repository lama di GitHub → Settings
2. Scroll ke bawah → **Delete this repository**
3. Konfirmasi nama repo → Delete

### Langkah 2: Buat Repository GitHub Baru

1. https://github.com → **New repository**
2. Nama: `ujian-teknik-sipil-utu` (atau bebas)
3. **Public** atau Private — keduanya bisa
4. Jangan centang "Add README" — biar bersih
5. **Create repository**

### Langkah 3: Upload File ke GitHub

**Cara Termudah — Drag & Drop di Web:**
1. Di halaman repo kosong, klik link **"uploading an existing file"**
2. Extract zip project ini di komputer
3. **Buka folder hasil extract** — lihat isinya (package.json, src/, dll)
4. **Pilih SEMUA file & folder** di dalam folder itu (Ctrl+A)
5. Drag-drop ke area upload GitHub
6. Tunggu sampai semua file ter-upload (lihat list di bawah)
7. Scroll bawah → commit message: `initial commit`
8. Klik **Commit changes**

⚠️ **PENTING:** Yang dipindah adalah ISI folder, bukan folder-nya. Folder `src/` harus muncul sebagai folder di GitHub, bukan terbungkus folder lain.

### Langkah 4: Hubungkan Vercel ke Repository Baru

**Kalau project Vercel sudah ada:**
1. Vercel dashboard → pilih project lama
2. **Settings** → **Git**
3. Klik **Disconnect** dari repo lama
4. Klik **Connect Git Repository** → pilih repo baru `ujian-teknik-sipil-utu`
5. Save → Vercel akan auto-deploy

**Kalau buat project Vercel baru:**
1. Vercel → **Add New** → **Project**
2. Import dari GitHub → pilih `ujian-teknik-sipil-utu`
3. Framework Preset: **Vite** (otomatis terdeteksi)
4. Sebelum Deploy, expand **Environment Variables** dan tambah:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` (dari Supabase) |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` (dari Supabase) |
   | `VITE_ADMIN_PASSWORD` | `dosen2026` (atau password pilihan) |

5. Klik **Deploy** → tunggu 1-2 menit

### Langkah 5: Setup Database Supabase

Kalau database belum ada / baru:
1. Buka Supabase → SQL Editor → New query
2. Salin SELURUH isi file `SETUP_DATABASE.sql` (di dalam zip)
3. Klik **Run** → harus muncul "Success"
4. Database otomatis berisi 3 ujian + 114 soal

Kalau database sudah ada dari sebelumnya: skip langkah ini.

## 📁 Struktur Project

```
ujian-teknik-sipil-utu/
├── src/
│   ├── App.jsx              (aplikasi utama)
│   ├── main.jsx             (entry point React)
│   ├── index.css            (styling)
│   └── supabaseClient.js    (koneksi database)
├── .env.example             (template environment)
├── .gitignore               (file yang di-skip Git)
├── index.html               (HTML utama)
├── package.json             (dependencies)
├── postcss.config.js        (config PostCSS)
├── tailwind.config.js       (config Tailwind)
├── vite.config.js           (config Vite)
├── SETUP_DATABASE.sql       (migration + bank soal awal)
└── README.md                (file ini)
```

## 🔑 Akses

- **Dosen:** Password ditentukan via Environment Variable `VITE_ADMIN_PASSWORD` di Vercel
- **Mahasiswa:** Hanya pilih ujian + isi nama+NIM, tidak perlu login

## 🎯 Cara Pakai

**Mahasiswa:**
1. Buka URL aplikasi
2. Pilih mata kuliah dari dropdown
3. Isi nama + NIM + kelas → klik Mulai Ujian
4. Kerjakan, klik Cek Jawaban untuk feedback instan
5. Klik Kirim Hasil saat selesai

**Dosen:**
1. Login dengan password
2. Pakai dropdown atas untuk pilih ujian
3. Tab Hasil: lihat nilai, export CSV
4. Tab Bank Soal: tambah/edit/import CSV
5. Tab Pengaturan: ubah durasi, buka/tutup ujian
6. Tombol "+ Ujian Baru" untuk tambah mata kuliah

## 💡 Tips

- Backup nilai sebelum hapus data: Export CSV dulu
- Buat ujian per mata kuliah dengan kode unik (UTS-MEKTAN-2026, UAS-BETON-2026, dll)
- Status default ujian baru = TUTUP. Buka via tab Pengaturan saat siap dipakai
- Mahasiswa yang lupa submit / koneksi putus: dosen reset hasilnya dari tab Hasil

---

© 2026 Universitas Teuku Umar — Fakultas Teknik • Prodi Teknik Sipil
