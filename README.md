# UTS Analisis Struktur Rangka Batang

Sistem ujian online interaktif untuk mata kuliah Analisis Struktur Rangka Batang.

## Fitur
- 18 soal interaktif (pilihan ganda + hitungan numerik)
- Feedback otomatis + pembahasan setiap soal
- Dashboard dosen real-time dengan statistik
- Export CSV
- Auto-skor & grade A-E

## Setup Cepat
1. Baca **PANDUAN.md** untuk langkah lengkap deploy ke Vercel
2. Salin `.env.example` ke `.env` dan isi credential Supabase
3. `npm install`
4. `npm run dev` untuk test lokal
5. Push ke GitHub → import ke Vercel

## Struktur File
```
uts-rangka/
├── src/
│   ├── App.jsx           # Aplikasi utama
│   ├── soal.js           # Bank soal (edit di sini!)
│   ├── supabaseClient.js # Koneksi database
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── .gitignore
└── PANDUAN.md            # Panduan deploy lengkap (BACA INI!)
```

## Edit Soal
Buka `src/soal.js` — semua soal ada di sana. Tiga tipe soal:
- `mc` : pilihan ganda
- `dual` : input numerik tunggal
- `numjenis` : input numerik + dropdown tarik/tekan

Setelah edit, push ke GitHub → Vercel akan auto re-deploy.
