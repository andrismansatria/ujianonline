import { useState, useEffect, useRef } from 'react'
import { supabase, ADMIN_PASSWORD, APP_NAME, UNIVERSITY, FACULTY } from './supabaseClient'

// ===== Helpers =====
function shuffle(array) {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatWaktu(detik) {
  if (detik < 0) detik = 0
  const h = Math.floor(detik / 3600)
  const m = Math.floor((detik % 3600) / 60)
  const s = detik % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// CSV Parser
function parseCSV(text) {
  const lines = []
  let line = []
  let cell = ''
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (inQuote) {
      if (ch === '"' && next === '"') { cell += '"'; i++ }
      else if (ch === '"') { inQuote = false }
      else { cell += ch }
    } else {
      if (ch === '"') { inQuote = true }
      else if (ch === ',') { line.push(cell); cell = '' }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && next === '\n') i++
        line.push(cell)
        if (line.some(c => c !== '')) lines.push(line)
        line = []
        cell = ''
      } else { cell += ch }
    }
  }
  if (cell !== '' || line.length > 0) { line.push(cell); if (line.some(c => c !== '')) lines.push(line) }
  return lines
}

// ===== Header Branding (dipakai di semua mode) =====
function HeaderBrand({ subtitle, color = 'blue' }) {
  const bg = color === 'green'
    ? 'from-emerald-800 to-emerald-600'
    : 'from-blue-900 via-blue-800 to-indigo-700'
  return (
    <div className={`bg-gradient-to-r ${bg} text-white px-6 py-5 relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-400 opacity-10 rounded-full -ml-16 -mb-16"></div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-amber-500 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-lg shadow-lg">UTU</div>
          <div>
            <h1 className="text-lg md:text-xl font-bold leading-tight">{APP_NAME}</h1>
            <p className="text-xs opacity-90">{UNIVERSITY}</p>
          </div>
        </div>
        <p className="text-xs opacity-80 mt-1">{FACULTY}</p>
        {subtitle && <p className="text-sm mt-2 font-medium border-t border-white border-opacity-20 pt-2">{subtitle}</p>}
      </div>
    </div>
  )
}

export default function App() {
  // ===== State =====
  const [mode, setMode] = useState('login')
  const [role, setRole] = useState('mahasiswa')
  const [nama, setNama] = useState('')
  const [nim, setNim] = useState('')
  const [kelas, setKelas] = useState('')
  const [adminPass, setAdminPass] = useState('')
  const [kodeUjian, setKodeUjian] = useState('')
  const [daftarUjian, setDaftarUjian] = useState([])

  const [jawaban, setJawaban] = useState({})
  const [skor, setSkor] = useState({})
  const [feedback, setFeedback] = useState({})
  const [hasilSemua, setHasilSemua] = useState([])
  const [bankSoal, setBankSoal] = useState([])
  const [soalSesi, setSoalSesi] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [adminTab, setAdminTab] = useState('hasil')
  const [editSoal, setEditSoal] = useState(null)
  const [showImportCSV, setShowImportCSV] = useState(false)
  const [showBuatUjian, setShowBuatUjian] = useState(false)

  const [config, setConfig] = useState(null)
  const [sesi, setSesi] = useState(null)
  const [sisaWaktu, setSisaWaktu] = useState(0)
  const [pindahTab, setPindahTab] = useState(0)
  const [warningTab, setWarningTab] = useState(false)
  const submittedRef = useRef(false)

  const totalBobot = soalSesi.reduce((s, q) => s + q.bobot, 0)

  // ===== Load daftar ujian saat mount =====
  useEffect(() => {
    loadDaftarUjian()
  }, [])

  const loadDaftarUjian = async () => {
    try {
      const { data } = await supabase
        .from('konfigurasi_ujian')
        .select('*')
        .order('kode_ujian')
      if (data && data.length > 0) {
        setDaftarUjian(data)
        // Set default ke ujian pertama yang berstatus 'buka', atau ujian pertama
        if (!kodeUjian) {
          const ujianBuka = data.find(u => u.status === 'buka') || data[0]
          setKodeUjian(ujianBuka.kode_ujian)
        }
      }
    } catch (e) {
      console.error('Gagal load daftar ujian:', e)
    }
  }

  // ===== Load config aktif =====
  useEffect(() => {
    if (!kodeUjian) return
    (async () => {
      try {
        const { data } = await supabase.from('konfigurasi_ujian').select('*').eq('kode_ujian', kodeUjian).single()
        if (data) setConfig(data)
      } catch (e) { setConfig(null) }
    })()
  }, [kodeUjian])

  // ===== Timer =====
  useEffect(() => {
    if (mode !== 'exam' || !sesi) return
    const interval = setInterval(() => {
      const mulai = new Date(sesi.waktu_mulai).getTime()
      const durasiMs = sesi.durasi_menit * 60 * 1000
      const sisa = Math.max(0, Math.floor((mulai + durasiMs - Date.now()) / 1000))
      setSisaWaktu(sisa)
      if (sisa === 0 && !submittedRef.current) { submittedRef.current = true; autoSubmit() }
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line
  }, [mode, sesi])

  // ===== Deteksi pindah tab =====
  useEffect(() => {
    if (mode !== 'exam' || !sesi) return
    const handler = async () => {
      if (document.hidden) {
        const newCount = pindahTab + 1
        setPindahTab(newCount)
        setWarningTab(true)
        try { await supabase.from('sesi_ujian').update({ pindah_tab_count: newCount }).eq('id', sesi.id) } catch (e) {}
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
    // eslint-disable-next-line
  }, [mode, sesi, pindahTab])

  // ===== Cegah tutup tab =====
  useEffect(() => {
    if (mode !== 'exam') return
    const h = (e) => { e.preventDefault(); e.returnValue = 'Anda sedang mengerjakan ujian. Yakin meninggalkan halaman?'; return e.returnValue }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [mode])

  // ===== Mulai Ujian =====
  const mulaiUjian = async () => {
    if (!nama || !nim) { alert('Nama dan NIM wajib diisi.'); return }
    if (!kodeUjian) { alert('Pilih ujian terlebih dahulu.'); return }
    setLoading(true); setError('')
    try {
      if (!config) { setError('Ujian tidak ditemukan.'); setLoading(false); return }
      if (config.status !== 'buka') {
        setError(`Ujian "${config.judul}" saat ini ditutup. Hubungi dosen untuk informasi.`)
        setLoading(false); return
      }

      const { data: cek } = await supabase.from('hasil_uts').select('*').eq('nim', nim).eq('kode_ujian', kodeUjian)
      if (cek && cek.length > 0) {
        const h = cek[0]
        setError(`NIM ${nim} sudah mengerjakan ujian ini pada ${new Date(h.created_at).toLocaleString('id-ID')}. Skor: ${h.total_skor}/${h.total_bobot} (Grade ${h.grade}). Tidak dapat mengulang.`)
        setLoading(false); return
      }

      const { data: sesiAda } = await supabase.from('sesi_ujian').select('*').eq('nim', nim).eq('kode_ujian', kodeUjian).maybeSingle()
      let sesiAktif
      if (sesiAda && sesiAda.status === 'aktif') {
        const mulai = new Date(sesiAda.waktu_mulai).getTime()
        const durasiMs = sesiAda.durasi_menit * 60 * 1000
        if (Math.floor((mulai + durasiMs - Date.now()) / 1000) <= 0) {
          setError('Sesi ujian Anda telah berakhir. Hubungi dosen untuk reset.'); setLoading(false); return
        }
        sesiAktif = sesiAda
        setPindahTab(sesiAda.pindah_tab_count || 0)
      } else {
        const { data: sBaru, error: errS } = await supabase.from('sesi_ujian').insert({
          kode_ujian: kodeUjian, nim, nama, kelas: kelas || '-',
          durasi_menit: config.durasi_menit, status: 'aktif', pindah_tab_count: 0
        }).select().single()
        if (errS) throw errS
        sesiAktif = sBaru
      }

      const { data: soalDb } = await supabase.from('bank_soal').select('*').eq('kode_ujian', kodeUjian).eq('aktif', true).order('nomor', { ascending: true })
      if (!soalDb || soalDb.length === 0) {
        setError('Belum ada soal aktif untuk ujian ini. Hubungi dosen.'); setLoading(false); return
      }

      const acak = shuffle(soalDb).map(s => s.tipe === 'mc' && Array.isArray(s.opsi) ? { ...s, opsi: shuffle(s.opsi) } : s)
      setSoalSesi(acak); setSesi(sesiAktif)
      submittedRef.current = false
      setMode('exam')
    } catch (e) { setError('Gagal memulai ujian: ' + e.message) }
    setLoading(false)
  }

  const cekJawaban = (soal) => {
    const j = jawaban[soal.id] || {}
    let s = 0, pesan = []
    if (soal.tipe === 'mc') {
      if (!j.pilihan) { alert('Pilih jawaban terlebih dahulu.'); return }
      if (j.pilihan === soal.benar) { s = soal.bobot; pesan.push(`✅ BENAR! Skor: ${s}/${soal.bobot}`) }
      else pesan.push(`❌ Kurang tepat. Jawaban benar: ${soal.benar}. Skor: 0/${soal.bobot}`)
    } else if (soal.tipe === 'dual') {
      const inp = soal.inputs[0]; const val = parseFloat(j[inp.id])
      if (isNaN(val)) { alert('Isi nilai terlebih dahulu.'); return }
      if (Math.abs(val - inp.benar) <= inp.tol) { s = inp.poin; pesan.push(`✅ BENAR! Skor: ${s}/${soal.bobot}`) }
      else pesan.push(`❌ Kurang tepat (Anda: ${val}, seharusnya ${inp.benar}). Skor: 0/${soal.bobot}`)
    } else if (soal.tipe === 'numjenis') {
      const iN = soal.inputs[0], iJ = soal.inputs[1]
      const val = parseFloat(j[iN.id]); const jen = j[iJ.id]
      if (isNaN(val) || !jen) { alert('Isi nilai dan jenis gaya terlebih dahulu.'); return }
      if (Math.abs(val - iN.benar) <= iN.tol) { s += iN.poin; pesan.push(`Nilai ✓ (+${iN.poin})`) } else pesan.push(`Nilai ✗ (seharusnya ${iN.benar})`)
      if (jen === iJ.benar) { s += iJ.poin; pesan.push(`Jenis ✓ (+${iJ.poin})`) } else pesan.push(`Jenis ✗ (seharusnya ${iJ.benar})`)
    }
    setSkor(p => ({ ...p, [soal.id]: s }))
    setFeedback(p => ({ ...p, [soal.id]: { status: s === soal.bobot ? 'correct' : s === 0 ? 'wrong' : 'partial', pesan: pesan.join(' • '), pembahasan: soal.pembahasan } }))
  }

  const kirimHasil = async (autoSubmitFlag = false) => {
    if (submittedRef.current && !autoSubmitFlag) return
    submittedRef.current = true
    const totalSkor = Object.values(skor).reduce((a, b) => a + b, 0)
    const persen = parseFloat((totalSkor / Math.max(totalBobot, 1) * 100).toFixed(1))
    let grade = 'E'
    if (totalSkor >= 0.8 * totalBobot) grade = 'A'
    else if (totalSkor >= 0.7 * totalBobot) grade = 'B'
    else if (totalSkor >= 0.6 * totalBobot) grade = 'C'
    else if (totalSkor >= 0.5 * totalBobot) grade = 'D'
    const dur = sesi ? Math.floor((Date.now() - new Date(sesi.waktu_mulai).getTime()) / 1000) : null
    setLoading(true)
    try {
      await supabase.from('hasil_uts').insert({
        nama, nim, kelas: kelas || '-', kode_ujian: kodeUjian,
        total_skor: totalSkor, total_bobot: totalBobot, persen, grade,
        jumlah_dijawab: Object.keys(skor).length, detail: skor,
        pindah_tab_count: pindahTab, durasi_pengerjaan_detik: dur, auto_submit: autoSubmitFlag
      })
      if (sesi) await supabase.from('sesi_ujian').update({ waktu_selesai: new Date().toISOString(), status: autoSubmitFlag ? 'expired' : 'selesai', pindah_tab_count: pindahTab }).eq('id', sesi.id)
      setMode('done')
    } catch (e) { alert('Gagal mengirim: ' + e.message); submittedRef.current = false }
    setLoading(false)
  }

  const submitHasil = () => kirimHasil(false)
  const autoSubmit = () => kirimHasil(true)

  // ===== Dashboard data =====
  const loadDashboard = async () => {
    if (!kodeUjian) return
    setLoading(true); setError('')
    try {
      const [h, b, c] = await Promise.all([
        supabase.from('hasil_uts').select('*').eq('kode_ujian', kodeUjian).order('created_at', { ascending: false }),
        supabase.from('bank_soal').select('*').eq('kode_ujian', kodeUjian).order('nomor', { ascending: true }),
        supabase.from('konfigurasi_ujian').select('*').eq('kode_ujian', kodeUjian).single()
      ])
      if (h.error) throw h.error
      if (b.error) throw b.error
      setHasilSemua(h.data || [])
      setBankSoal(b.data || [])
      if (c.data) setConfig(c.data)
      await loadDaftarUjian()
    } catch (e) { setError('Gagal memuat: ' + e.message) }
    setLoading(false)
  }

  // Auto-reload saat ganti ujian di dashboard
  useEffect(() => {
    if (mode === 'dashboard' && kodeUjian) {
      loadDashboard()
    }
    // eslint-disable-next-line
  }, [kodeUjian, mode])

  const updateConfig = async (patch) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('konfigurasi_ujian').update(patch).eq('kode_ujian', kodeUjian).select().single()
      if (error) throw error
      setConfig(data)
      await loadDaftarUjian()
      alert('Pengaturan tersimpan.')
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  const buatUjianBaru = async (kode, judul, durasi) => {
    if (!kode || !judul) { alert('Kode dan judul wajib diisi'); return }
    setLoading(true)
    try {
      const kodeFinal = kode.toUpperCase().replace(/\s+/g, '-')
      const { error } = await supabase.from('konfigurasi_ujian').insert({
        kode_ujian: kodeFinal,
        judul, durasi_menit: parseInt(durasi) || 120, status: 'tutup'
      })
      if (error) throw error
      await loadDaftarUjian()
      setKodeUjian(kodeFinal)
      setShowBuatUjian(false)
      alert(`Ujian "${kodeFinal}" berhasil dibuat. Sekarang Bapak/Ibu bisa import soal untuknya.`)
    } catch (e) { alert('Gagal: ' + e.message + '\n\n(Mungkin kode sudah dipakai)') }
    setLoading(false)
  }

  const hapusUjian = async () => {
    if (!confirm(`Hapus ujian "${config.judul}" beserta SEMUA soal, hasil, dan sesi terkait? Tindakan ini PERMANEN.`)) return
    setLoading(true)
    try {
      await supabase.from('hasil_uts').delete().eq('kode_ujian', kodeUjian)
      await supabase.from('sesi_ujian').delete().eq('kode_ujian', kodeUjian)
      await supabase.from('bank_soal').delete().eq('kode_ujian', kodeUjian)
      await supabase.from('konfigurasi_ujian').delete().eq('kode_ujian', kodeUjian)
      alert('Ujian dihapus.')
      await loadDaftarUjian()
      const sisaUjian = daftarUjian.filter(u => u.kode_ujian !== kodeUjian)
      if (sisaUjian.length > 0) setKodeUjian(sisaUjian[0].kode_ujian)
      else setKodeUjian('')
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  // ===== Import CSV =====
  const handleFileImport = async (file) => {
    if (!file) return
    setLoading(true)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (rows.length < 2) { alert('File kosong atau format salah.'); setLoading(false); return }

      const header = rows[0].map(h => h.trim().toLowerCase())
      const idx = (name) => header.indexOf(name.toLowerCase())
      const required = ['nomor', 'topik', 'bobot', 'tipe', 'pertanyaan']
      for (const r of required) {
        if (idx(r) === -1) { alert(`Kolom wajib "${r}" tidak ditemukan.`); setLoading(false); return }
      }

      const soalBaru = []; const errors = []
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        if (r.every(c => !c)) continue
        const tipe = (r[idx('tipe')] || '').trim().toLowerCase()
        if (!['mc', 'dual', 'numjenis'].includes(tipe)) { errors.push(`Baris ${i+1}: tipe invalid`); continue }
        const soal = {
          kode_ujian: kodeUjian,
          nomor: parseInt(r[idx('nomor')]) || (soalBaru.length + 1),
          topik: r[idx('topik')] || 'Umum',
          bobot: parseInt(r[idx('bobot')]) || 5,
          tipe, pertanyaan: r[idx('pertanyaan')] || '',
          figure: r[idx('figure')] || null,
          pembahasan: r[idx('pembahasan')] || null,
          aktif: true
        }
        if (tipe === 'mc') {
          const opsi = []
          for (const lab of ['A','B','C','D','E']) {
            const v = r[idx('opsi_' + lab)]
            if (v) opsi.push({ val: lab, text: v })
          }
          if (opsi.length < 2) { errors.push(`Baris ${i+1}: butuh min 2 pilihan`); continue }
          soal.opsi = opsi
          soal.benar = (r[idx('benar')] || '').trim().toUpperCase()
          if (!soal.benar) { errors.push(`Baris ${i+1}: kolom 'benar' kosong`); continue }
        } else if (tipe === 'dual') {
          soal.inputs = [{
            id: 'nilai', label: r[idx('input1_label')] || 'Nilai =',
            satuan: r[idx('input1_satuan')] || 'kN',
            benar: parseFloat(r[idx('input1_benar')]) || 0,
            tol: parseFloat(r[idx('input1_tol')]) || 0.1,
            poin: parseInt(r[idx('input1_poin')]) || soal.bobot
          }]
        } else if (tipe === 'numjenis') {
          soal.inputs = [
            { id: 'nilai', label: r[idx('input1_label')] || 'Nilai =', satuan: r[idx('input1_satuan')] || 'kN',
              benar: parseFloat(r[idx('input1_benar')]) || 0, tol: parseFloat(r[idx('input1_tol')]) || 0.1,
              poin: parseInt(r[idx('input1_poin')]) || Math.floor(soal.bobot / 2) },
            { id: 'jenis', label: 'Jenis:',
              benar: (r[idx('input2_jenis_benar')] || 'tarik').toLowerCase(),
              poin: parseInt(r[idx('input2_poin')]) || Math.ceil(soal.bobot / 2) }
          ]
        }
        soalBaru.push(soal)
      }
      if (errors.length > 0) {
        if (!confirm(`${errors.length} error ditemukan:\n\n${errors.slice(0, 5).join('\n')}\n\n${soalBaru.length} baris valid akan diimport. Lanjut?`)) { setLoading(false); return }
      }
      if (soalBaru.length === 0) { alert('Tidak ada soal valid.'); setLoading(false); return }
      if (!confirm(`Import ${soalBaru.length} soal ke "${config?.judul || kodeUjian}"?`)) { setLoading(false); return }
      const { error } = await supabase.from('bank_soal').insert(soalBaru)
      if (error) throw error
      await loadDashboard()
      setShowImportCSV(false)
      alert(`✅ Berhasil import ${soalBaru.length} soal!`)
    } catch (e) { alert('Gagal import: ' + e.message) }
    setLoading(false)
  }

  const downloadTemplate = () => {
    const template = `nomor,topik,bobot,tipe,pertanyaan,figure,opsi_A,opsi_B,opsi_C,opsi_D,benar,input1_label,input1_satuan,input1_benar,input1_tol,input1_poin,input2_jenis_benar,input2_poin,pembahasan
1,Konsep,5,mc,"Apa BUKAN asumsi rangka batang ideal?",,"Sambungan sendi","Beban di buhul","Batang menerima momen","Sumbu batang lurus",C,,,,,,,,Rangka ideal hanya gaya aksial.
2,Titik Buhul,8,dual,"Segitiga AB=8m P=20kN. V_A?",,,,,,,V_A =,kN,10,0.1,8,,,Simetris V_A=V_B=10 kN.
3,Titik Buhul,10,numjenis,"Hitung |S_AC| dan jenisnya.","sin θ=0.6 cos θ=0.8",,,,,,|S_AC| =,kN,16.67,0.15,5,tekan,5,ΣFy: 10+S×0.6=0 → TEKAN 16.67 kN.
`
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'template_soal.csv'
    a.click()
  }

  const exportSoalCSV = () => {
    if (bankSoal.length === 0) return
    const header = 'nomor,topik,bobot,tipe,pertanyaan,figure,opsi_A,opsi_B,opsi_C,opsi_D,benar,input1_label,input1_satuan,input1_benar,input1_tol,input1_poin,input2_jenis_benar,input2_poin,pembahasan\n'
    const escape = (s) => {
      if (s === null || s === undefined) return ''
      const str = String(s)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return '"' + str.replace(/"/g, '""') + '"'
      return str
    }
    const rows = bankSoal.map(s => {
      const ops = (s.opsi || []).reduce((acc, o) => { acc[o.val] = o.text; return acc }, {})
      const i1 = (s.inputs && s.inputs[0]) || {}; const i2 = (s.inputs && s.inputs[1]) || {}
      return [s.nomor, s.topik, s.bobot, s.tipe, s.pertanyaan, s.figure || '',
              ops.A || '', ops.B || '', ops.C || '', ops.D || '', s.benar || '',
              i1.label || '', i1.satuan || '', i1.benar ?? '', i1.tol ?? '', i1.poin ?? '',
              i2.benar || '', i2.poin ?? '', s.pembahasan || ''].map(escape).join(',')
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `soal_${kodeUjian}.csv`
    a.click()
  }

  const toggleAktif = async (soal) => {
    try {
      await supabase.from('bank_soal').update({ aktif: !soal.aktif }).eq('id', soal.id)
      setBankSoal(prev => prev.map(s => s.id === soal.id ? { ...s, aktif: !s.aktif } : s))
    } catch (e) { alert(e.message) }
  }

  const hapusSoal = async (id) => {
    if (!confirm('Hapus soal ini?')) return
    try {
      await supabase.from('bank_soal').delete().eq('id', id)
      setBankSoal(prev => prev.filter(s => s.id !== id))
    } catch (e) { alert(e.message) }
  }

  const hapusSemuaSoal = async () => {
    if (!confirm(`Hapus SEMUA ${bankSoal.length} soal di ujian ini? Hasil mahasiswa tidak terhapus.`)) return
    setLoading(true)
    try {
      await supabase.from('bank_soal').delete().eq('kode_ujian', kodeUjian)
      setBankSoal([])
      alert('Semua soal dihapus.')
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  const simpanSoal = async (soal) => {
    setLoading(true)
    try {
      const payload = {
        nomor: parseInt(soal.nomor) || null, topik: soal.topik, bobot: parseInt(soal.bobot) || 5,
        tipe: soal.tipe, pertanyaan: soal.pertanyaan, figure: soal.figure || null,
        opsi: soal.opsi || null, benar: soal.benar || null, inputs: soal.inputs || null,
        pembahasan: soal.pembahasan || null, kode_ujian: kodeUjian, aktif: soal.aktif !== false
      }
      if (soal.id) await supabase.from('bank_soal').update(payload).eq('id', soal.id)
      else await supabase.from('bank_soal').insert(payload)
      await loadDashboard()
      setEditSoal(null)
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  const hapusSemuaHasil = async () => {
    if (!confirm('Hapus SEMUA hasil mahasiswa di ujian ini?')) return
    setLoading(true)
    try {
      await supabase.from('hasil_uts').delete().eq('kode_ujian', kodeUjian)
      await supabase.from('sesi_ujian').delete().eq('kode_ujian', kodeUjian)
      setHasilSemua([])
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  const hapusHasilNim = async (id, nim) => {
    if (!confirm(`Reset hasil NIM ${nim}?`)) return
    try {
      await supabase.from('hasil_uts').delete().eq('id', id)
      await supabase.from('sesi_ujian').delete().eq('nim', nim).eq('kode_ujian', kodeUjian)
      setHasilSemua(prev => prev.filter(h => h.id !== id))
    } catch (e) { alert(e.message) }
  }

  const exportCSV = () => {
    if (hasilSemua.length === 0) return
    const header = 'Waktu,Nama,NIM,Kelas,Skor,Total,Persen,Grade,Pindah Tab,Durasi (menit),Auto-Submit\n'
    const rows = hasilSemua.map(h => {
      const dur = h.durasi_pengerjaan_detik ? (h.durasi_pengerjaan_detik/60).toFixed(1) : '-'
      return `${new Date(h.created_at).toLocaleString('id-ID')},"${h.nama}",${h.nim},${h.kelas},${h.total_skor},${h.total_bobot},${h.persen}%,${h.grade},${h.pindah_tab_count||0},${dur},${h.auto_submit ? 'Ya' : 'Tidak'}`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Nilai_${kodeUjian}_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  // ============ LOGIN ============
  if (mode === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-4 md:p-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          <HeaderBrand subtitle="Sistem Ujian Online" />

          <div className="p-6">
            <div className="flex gap-2 mb-4">
              <button onClick={() => { setRole('mahasiswa'); setError('') }} className={`flex-1 py-2.5 rounded-lg font-semibold transition ${role==='mahasiswa' ? 'bg-blue-700 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>👨‍🎓 Mahasiswa</button>
              <button onClick={() => { setRole('dosen'); setError('') }} className={`flex-1 py-2.5 rounded-lg font-semibold transition ${role==='dosen' ? 'bg-blue-700 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>👨‍🏫 Dosen</button>
            </div>

            {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-3 mb-3 text-sm rounded">{error}</div>}

            {/* Dropdown ujian — selalu tampil */}
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-600 block mb-1">📚 Pilih Mata Kuliah / Ujian</label>
              {daftarUjian.length === 0 ? (
                <div className="px-3 py-2 border-2 border-amber-300 bg-amber-50 text-amber-800 rounded-lg text-sm">
                  Belum ada ujian. Dosen perlu membuat ujian dulu di dashboard.
                </div>
              ) : (
                <select value={kodeUjian} onChange={e => setKodeUjian(e.target.value)} className="w-full px-3 py-2.5 border-2 border-slate-300 rounded-lg bg-white">
                  {daftarUjian.map(u => (
                    <option key={u.kode_ujian} value={u.kode_ujian}>
                      {u.judul} {u.status === 'buka' ? '🟢' : '🔴'}
                    </option>
                  ))}
                </select>
              )}
              {config && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-600">Kode: <strong className="font-mono">{config.kode_ujian}</strong></span>
                  <span className="text-slate-600">⏱️ {config.durasi_menit} menit</span>
                </div>
              )}
            </div>

            {role === 'mahasiswa' ? (
              <div className="space-y-3">
                <input className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:border-blue-500 outline-none" placeholder="Nama Lengkap" value={nama} onChange={e=>setNama(e.target.value)} />
                <input className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:border-blue-500 outline-none" placeholder="NIM" value={nim} onChange={e=>setNim(e.target.value)} />
                <input className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:border-blue-500 outline-none" placeholder="Kelas / Kelompok" value={kelas} onChange={e=>setKelas(e.target.value)} />
                <button onClick={mulaiUjian} disabled={loading || daftarUjian.length === 0} className="w-full bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-3 rounded-lg shadow-md transition">
                  {loading ? 'Memuat...' : '⏱️ Mulai Ujian'}
                </button>
                <div className="text-xs bg-amber-50 border-l-4 border-amber-500 p-3 rounded space-y-1">
                  <p className="font-semibold text-amber-900">⚠️ Peraturan Ujian:</p>
                  <ul className="text-amber-800 list-disc list-inside space-y-0.5">
                    <li>Setiap NIM hanya 1× kesempatan</li>
                    <li>Timer mulai begitu klik "Mulai Ujian"</li>
                    <li>Pindah tab/window tercatat di sistem</li>
                    <li>Waktu habis → otomatis dikirim</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input type="password" className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:border-blue-500 outline-none" placeholder="Password Dosen" value={adminPass} onChange={e=>setAdminPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && document.getElementById('btn-login-dosen')?.click()} />
                <button id="btn-login-dosen" onClick={async () => {
                  if (adminPass !== ADMIN_PASSWORD) { alert('Password salah.'); return }
                  await loadDashboard()
                  setMode('dashboard')
                }} className="w-full bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white font-bold py-3 rounded-lg shadow-md">Masuk Dashboard</button>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 text-center text-xs text-slate-500">
            © 2026 {UNIVERSITY} — All rights reserved
          </div>
        </div>
      </div>
    )
  }

  // ============ EXAM ============
  if (mode === 'exam') {
    const dijawab = Object.keys(skor).length
    const progress = soalSesi.length > 0 ? (dijawab / soalSesi.length * 100) : 0
    const sisaMenit = Math.floor(sisaWaktu / 60)
    const warna = sisaMenit > 30 ? 'bg-emerald-600' : sisaMenit > 10 ? 'bg-amber-500' : 'bg-red-600 animate-pulse'

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-700 text-white p-4 md:p-5 sticky top-0 z-10 shadow-md">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="bg-amber-500 px-2 py-0.5 rounded text-xs font-bold">UTU</div>
                  <h1 className="text-base md:text-lg font-bold truncate">{config?.judul}</h1>
                </div>
                <p className="text-xs opacity-90">{nama} • NIM {nim} • {kelas}</p>
              </div>
              <div className={`${warna} text-white px-4 py-2 rounded-lg shadow-lg`}>
                <div className="text-xs opacity-90 text-center">SISA WAKTU</div>
                <div className="text-xl md:text-2xl font-bold font-mono text-center">{formatWaktu(sisaWaktu)}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-between items-center text-xs flex-wrap gap-2">
              <span>Dijawab: <strong>{dijawab}/{soalSesi.length}</strong></span>
              <span>Bobot: {totalBobot} poin</span>
              {pindahTab > 0 && <span className="bg-red-500 px-2 py-0.5 rounded-full font-bold">⚠️ Pindah Tab: {pindahTab}x</span>}
            </div>
            <div className="mt-2 h-1.5 bg-blue-950 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 transition-all" style={{width: `${progress}%`}}></div>
            </div>
          </div>

          {warningTab && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl max-w-md w-full p-6 text-center">
                <div className="text-5xl mb-3">⚠️</div>
                <h3 className="text-xl font-bold text-red-700 mb-2">Peringatan!</h3>
                <p className="text-slate-700 mb-3">Anda terdeteksi keluar dari halaman ujian. Aktivitas ini tercatat dan akan dilaporkan ke dosen.</p>
                <p className="text-sm bg-red-50 text-red-800 p-2 rounded mb-4">Total pindah tab: <strong>{pindahTab}x</strong></p>
                <button onClick={() => setWarningTab(false)} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded">Saya Mengerti</button>
              </div>
            </div>
          )}

          <div className="p-4 md:p-5 space-y-4 md:space-y-5">
            {soalSesi.map((soal, idx) => {
              const fb = feedback[soal.id]; const j = jawaban[soal.id] || {}
              const setJ = (k, v) => setJawaban(p => ({ ...p, [soal.id]: { ...p[soal.id], [k]: v } }))
              return (
                <div key={soal.id} className="border-2 border-slate-200 rounded-xl p-4 md:p-5 hover:border-blue-300 transition">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-blue-700 text-white px-3 py-1 rounded-full text-xs font-bold">SOAL {idx+1}</span>
                    <span className="bg-slate-200 px-3 py-1 rounded-full text-xs">{soal.topik}</span>
                    <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold">{soal.bobot} poin</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed mb-3">{soal.pertanyaan}</p>
                  {soal.figure && <pre className="bg-slate-50 border-l-4 border-blue-500 p-3 text-xs font-mono whitespace-pre-wrap mb-3 overflow-x-auto">{soal.figure}</pre>}

                  {soal.tipe === 'mc' && Array.isArray(soal.opsi) && (
                    <div className="space-y-2">
                      {soal.opsi.map(o => (
                        <label key={o.val} className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition
                          ${j.pilihan === o.val ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}
                          ${fb && o.val === soal.benar ? '!border-emerald-500 !bg-emerald-50' : ''}
                          ${fb && j.pilihan === o.val && o.val !== soal.benar ? '!border-red-500 !bg-red-50' : ''}`}>
                          <input type="radio" name={'s-' + soal.id} checked={j.pilihan === o.val} onChange={() => setJ('pilihan', o.val)} disabled={!!fb} className="mt-1" />
                          <span className="text-sm"><strong>{o.val}.</strong> {o.text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {soal.tipe === 'dual' && Array.isArray(soal.inputs) && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="font-semibold">{soal.inputs[0].label}</label>
                      <input type="number" step="0.01" value={j[soal.inputs[0].id] || ''} onChange={e => setJ(soal.inputs[0].id, e.target.value)} disabled={!!fb} className="px-3 py-2 border-2 border-slate-300 rounded-lg w-32 focus:border-blue-500 outline-none" />
                      <span className="text-slate-600 font-semibold">{soal.inputs[0].satuan}</span>
                    </div>
                  )}

                  {soal.tipe === 'numjenis' && Array.isArray(soal.inputs) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="font-semibold min-w-24">{soal.inputs[0].label}</label>
                        <input type="number" step="0.01" value={j[soal.inputs[0].id] || ''} onChange={e => setJ(soal.inputs[0].id, e.target.value)} disabled={!!fb} className="px-3 py-2 border-2 border-slate-300 rounded-lg w-32 focus:border-blue-500 outline-none" />
                        <span className="text-slate-600 font-semibold">{soal.inputs[0].satuan}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="font-semibold min-w-24">{soal.inputs[1].label}</label>
                        <select value={j[soal.inputs[1].id] || ''} onChange={e => setJ(soal.inputs[1].id, e.target.value)} disabled={!!fb} className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 outline-none">
                          <option value="">-- pilih --</option>
                          <option value="tarik">Tarik (+)</option>
                          <option value="tekan">Tekan (−)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {!fb && <button onClick={() => cekJawaban(soal)} className="mt-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2 rounded-lg transition">Cek Jawaban</button>}
                  {fb && (
                    <div className={`mt-3 p-4 rounded-lg border-l-4
                      ${fb.status === 'correct' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : ''}
                      ${fb.status === 'wrong' ? 'bg-red-50 border-red-500 text-red-900' : ''}
                      ${fb.status === 'partial' ? 'bg-amber-50 border-amber-500 text-amber-900' : ''}`}>
                      <div className="font-semibold text-sm">{fb.pesan}</div>
                      <div className="mt-2 pt-2 border-t border-current border-opacity-20 text-xs"><strong>📘 Pembahasan: </strong>{fb.pembahasan}</div>
                    </div>
                  )}
                </div>
              )
            })}

            <div className="bg-slate-50 rounded-xl p-6 text-center border-2 border-dashed border-slate-300">
              <p className="text-slate-600 mb-3">Selesai? Kirim hasil sekarang.</p>
              <p className="text-xs text-red-700 mb-2 font-semibold">⚠️ Tidak dapat mengulang setelah dikirim!</p>
              <p className="text-xs text-slate-500 mb-4">Skor sementara: <strong className="text-2xl text-blue-700">{Object.values(skor).reduce((a,b)=>a+b,0)}/{totalBobot}</strong></p>
              <button onClick={submitHasil} disabled={loading || Object.keys(skor).length === 0} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold px-8 py-3 rounded-lg shadow-lg disabled:from-slate-400 disabled:to-slate-500">
                {loading ? 'Mengirim...' : '📨 Kirim Hasil ke Dosen'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============ DONE ============
  if (mode === 'done') {
    const total = Object.values(skor).reduce((a,b)=>a+b, 0)
    const persen = (total / Math.max(totalBobot,1) * 100).toFixed(1)
    let grade = 'E', gradeColor = 'bg-red-600'
    if (total >= 0.8*totalBobot) { grade = 'A'; gradeColor = 'bg-emerald-600' }
    else if (total >= 0.7*totalBobot) { grade = 'B'; gradeColor = 'bg-blue-600' }
    else if (total >= 0.6*totalBobot) { grade = 'C'; gradeColor = 'bg-amber-500' }
    else if (total >= 0.5*totalBobot) { grade = 'D'; gradeColor = 'bg-orange-600' }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
          <HeaderBrand subtitle={sisaWaktu === 0 ? '⏰ Waktu Habis' : '🎓 Ujian Selesai'} />
          <div className="p-6 text-center">
            <p className="text-sm text-slate-600 mb-1">{nama}</p>
            <p className="text-xs text-slate-500 mb-1">NIM: {nim}</p>
            <p className="text-xs text-slate-500 mb-4">{config?.judul}</p>
            <div className="text-5xl md:text-6xl font-bold my-5 text-blue-700">{total}<span className="text-xl md:text-2xl opacity-60">/{totalBobot}</span></div>
            <div className={`inline-block ${gradeColor} text-white px-6 py-2 rounded-full text-xl font-bold shadow-lg`}>Nilai: {grade}</div>
            <p className="mt-3 text-sm text-slate-600">Persentase: <strong>{persen}%</strong></p>
            {pindahTab > 0 && <p className="mt-2 text-xs bg-red-100 text-red-700 inline-block px-3 py-1 rounded-full">Pindah tab tercatat: {pindahTab}x</p>}
            <p className="mt-4 text-sm text-emerald-700 font-semibold bg-emerald-50 py-2 rounded">✅ Hasil telah dikirim ke dosen</p>
            <button onClick={() => window.location.reload()} className="mt-4 w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-lg">Kembali ke Halaman Awal</button>
          </div>
        </div>
      </div>
    )
  }

  // ============ DASHBOARD DOSEN ============
  if (mode === 'dashboard') {
    const rata = hasilSemua.length > 0 ? (hasilSemua.reduce((s,h) => s + parseFloat(h.total_skor), 0) / hasilSemua.length).toFixed(1) : 0
    const gradeCount = { A: 0, B: 0, C: 0, D: 0, E: 0 }
    hasilSemua.forEach(h => gradeCount[h.grade]++)
    const aktifCount = bankSoal.filter(s => s.aktif).length
    const pindahTabCount = hasilSemua.filter(h => (h.pindah_tab_count || 0) > 0).length
    const autoSubmitCount = hasilSemua.filter(h => h.auto_submit).length

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <HeaderBrand subtitle="📊 Dashboard Dosen" color="green" />

          {/* Action bar */}
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-3 flex justify-end gap-2 flex-wrap">
            <button onClick={loadDashboard} className="bg-white hover:bg-slate-100 text-emerald-800 font-semibold px-4 py-2 rounded-lg shadow-sm text-sm">🔄 Refresh</button>
            <button onClick={() => setMode('login')} className="bg-emerald-900 hover:bg-emerald-950 text-white font-semibold px-4 py-2 rounded-lg shadow-sm text-sm">Keluar</button>
          </div>

          {/* Selector ujian — PROMINENT */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-bold text-blue-900 whitespace-nowrap">📚 Ujian Aktif:</label>
              {daftarUjian.length === 0 ? (
                <span className="text-sm text-amber-700">Belum ada ujian. Klik "+ Ujian Baru".</span>
              ) : (
                <select value={kodeUjian} onChange={e => setKodeUjian(e.target.value)} className="px-3 py-2 border-2 border-blue-300 rounded-lg flex-1 min-w-48 bg-white font-medium">
                  {daftarUjian.map(u => (
                    <option key={u.kode_ujian} value={u.kode_ujian}>
                      {u.judul} ({u.kode_ujian}) {u.status === 'buka' ? '🟢 BUKA' : '🔴 TUTUP'}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={() => setShowBuatUjian(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-lg shadow-sm whitespace-nowrap">+ Ujian Baru</button>
            </div>
            {config && (
              <div className="mt-2 text-xs text-blue-800 flex gap-4 flex-wrap">
                <span>Kode: <strong className="font-mono">{config.kode_ujian}</strong></span>
                <span>Durasi: <strong>{config.durasi_menit} menit</strong></span>
                <span>Status: <strong>{config.status === 'buka' ? '🟢 BUKA' : '🔴 TUTUP'}</strong></span>
                <span>Soal aktif: <strong>{aktifCount}/{bankSoal.length}</strong></span>
              </div>
            )}
          </div>

          {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-3 text-sm">{error}</div>}

          {/* Tabs */}
          <div className="flex border-b overflow-x-auto bg-white">
            <button onClick={() => setAdminTab('hasil')} className={`px-6 py-3 font-semibold whitespace-nowrap transition ${adminTab==='hasil' ? 'border-b-2 border-emerald-700 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>📋 Hasil ({hasilSemua.length})</button>
            <button onClick={() => setAdminTab('soal')} className={`px-6 py-3 font-semibold whitespace-nowrap transition ${adminTab==='soal' ? 'border-b-2 border-emerald-700 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>📚 Bank Soal ({bankSoal.length})</button>
            <button onClick={() => setAdminTab('config')} className={`px-6 py-3 font-semibold whitespace-nowrap transition ${adminTab==='config' ? 'border-b-2 border-emerald-700 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>⚙️ Pengaturan</button>
          </div>

          {/* TAB HASIL */}
          {adminTab === 'hasil' && (
            <>
              <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-3 border-b">
                <div className="bg-blue-50 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-blue-700">{hasilSemua.length}</div><div className="text-xs mt-1">Total Peserta</div></div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-emerald-700">{rata}</div><div className="text-xs mt-1">Rata-rata Skor</div></div>
                <div className="bg-amber-50 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-amber-700">{gradeCount.A + gradeCount.B}</div><div className="text-xs mt-1">Lulus (A/B)</div></div>
                <div className="bg-red-50 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-red-700">{pindahTabCount}</div><div className="text-xs mt-1">Pernah Pindah Tab</div></div>
                <div className="bg-orange-50 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-orange-700">{autoSubmitCount}</div><div className="text-xs mt-1">Auto-Submit</div></div>
              </div>

              <div className="p-5 border-b">
                <h3 className="font-bold text-slate-700 mb-3">Distribusi Nilai</h3>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(gradeCount).map(([g, c]) => {
                    const colors = { A: 'bg-emerald-100 text-emerald-800', B: 'bg-blue-100 text-blue-800', C: 'bg-amber-100 text-amber-800', D: 'bg-orange-100 text-orange-800', E: 'bg-red-100 text-red-800' }
                    return (
                      <div key={g} className={`flex-1 min-w-20 rounded-lg p-3 text-center ${colors[g]}`}>
                        <div className="font-bold text-2xl">{g}</div>
                        <div className="text-sm">{c} orang</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="p-5">
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                  <h3 className="font-bold text-slate-700">Daftar Nilai Mahasiswa</h3>
                  <div className="flex gap-2">
                    <button onClick={exportCSV} disabled={hasilSemua.length===0} className="text-xs bg-blue-100 text-blue-800 px-3 py-1.5 rounded hover:bg-blue-200 disabled:opacity-50">📥 Export CSV</button>
                    <button onClick={hapusSemuaHasil} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded hover:bg-red-200">🗑 Hapus Semua</button>
                  </div>
                </div>
                {hasilSemua.length === 0 ? <p className="text-center py-10 text-slate-500">Belum ada submission.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-slate-100">
                        <th className="p-2">No</th><th className="p-2 text-left">Nama</th><th className="p-2 text-left">NIM</th>
                        <th className="p-2">Skor</th><th className="p-2">%</th><th className="p-2">Grade</th>
                        <th className="p-2">⏱</th><th className="p-2">⚠️</th><th className="p-2">Auto</th>
                        <th className="p-2 text-left">Waktu</th><th className="p-2">Aksi</th>
                      </tr></thead>
                      <tbody>
                        {hasilSemua.map((h, i) => {
                          const tab = h.pindah_tab_count || 0
                          return (
                            <tr key={h.id} className={`border-b hover:bg-slate-50 ${tab > 2 ? 'bg-red-50' : ''}`}>
                              <td className="p-2 text-center">{i+1}</td>
                              <td className="p-2 font-semibold">{h.nama}</td>
                              <td className="p-2 font-mono text-xs">{h.nim}</td>
                              <td className="p-2 text-center font-bold">{h.total_skor}/{h.total_bobot}</td>
                              <td className="p-2 text-center">{h.persen}%</td>
                              <td className="p-2 text-center">
                                <span className={`inline-block px-2 py-1 rounded text-white text-xs font-bold
                                  ${h.grade==='A'?'bg-emerald-600':h.grade==='B'?'bg-blue-600':h.grade==='C'?'bg-amber-500':h.grade==='D'?'bg-orange-600':'bg-red-600'}`}>{h.grade}</span>
                              </td>
                              <td className="p-2 text-center text-xs">{h.durasi_pengerjaan_detik ? `${(h.durasi_pengerjaan_detik/60).toFixed(0)}m` : '-'}</td>
                              <td className="p-2 text-center">{tab > 0 ? <span className={`px-2 py-0.5 rounded text-xs font-bold ${tab > 2 ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>{tab}x</span> : '-'}</td>
                              <td className="p-2 text-center text-xs">{h.auto_submit ? '⏰' : '✓'}</td>
                              <td className="p-2 text-xs text-slate-600">{new Date(h.created_at).toLocaleString('id-ID')}</td>
                              <td className="p-2 text-center"><button onClick={() => hapusHasilNim(h.id, h.nim)} className="text-xs text-red-600 hover:underline" title="Reset hasil">🔄</button></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB BANK SOAL */}
          {adminTab === 'soal' && (
            <div className="p-5">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-700">Bank Soal — {config?.judul}</h3>
                  <p className="text-xs text-slate-500">Total: {bankSoal.length} • Aktif: {aktifCount} • Bobot aktif: {bankSoal.filter(s=>s.aktif).reduce((a,b)=>a+b.bobot,0)} poin</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setShowImportCSV(true)} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-3 py-1.5 rounded shadow-sm">📂 Import CSV</button>
                  <button onClick={() => setEditSoal({ tipe: 'mc', topik: 'Konsep', bobot: 5, opsi: [{val:'A',text:''},{val:'B',text:''},{val:'C',text:''},{val:'D',text:''}], aktif: true })} className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-3 py-1.5 rounded shadow-sm">+ Tambah Soal</button>
                  {bankSoal.length > 0 && <button onClick={exportSoalCSV} className="bg-slate-200 hover:bg-slate-300 text-sm font-semibold px-3 py-1.5 rounded">📥 Export</button>}
                </div>
              </div>

              {bankSoal.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-slate-500">Bank soal masih kosong untuk ujian ini.</p>
                  <button onClick={() => setShowImportCSV(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg">📂 Import dari CSV</button>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <button onClick={hapusSemuaSoal} className="text-xs text-red-600 hover:underline">🗑 Hapus semua soal di ujian ini</button>
                  </div>
                  <div className="space-y-2">
                    {bankSoal.map((s, i) => (
                      <div key={s.id} className={`border-2 rounded-lg p-3 transition ${s.aktif ? 'border-slate-200 hover:border-blue-300' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
                        <div className="flex justify-between items-start gap-2 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-1 mb-1 items-center">
                              <span className="bg-slate-200 px-2 py-0.5 rounded text-xs font-bold">#{s.nomor || i+1}</span>
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{s.topik}</span>
                              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">{s.bobot}p</span>
                              <span className="text-xs text-slate-500">{s.tipe}</span>
                              {!s.aktif && <span className="bg-slate-300 px-2 py-0.5 rounded text-xs">NON-AKTIF</span>}
                            </div>
                            <p className="text-sm line-clamp-2">{s.pertanyaan}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => toggleAktif(s)} className={`text-xs px-2 py-1 rounded ${s.aktif ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{s.aktif ? '⏸' : '▶'}</button>
                            <button onClick={() => setEditSoal(s)} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">✏️</button>
                            <button onClick={() => hapusSoal(s.id)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">🗑</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB PENGATURAN */}
          {adminTab === 'config' && config && (
            <div className="p-5 max-w-xl">
              <h3 className="font-bold text-slate-700 mb-4">⚙️ Pengaturan Ujian: <span className="font-mono text-blue-700">{kodeUjian}</span></h3>
              <div className="space-y-4 bg-slate-50 p-5 rounded-xl">
                <div>
                  <label className="text-sm font-semibold block mb-1">Judul Ujian</label>
                  <input type="text" value={config.judul} onChange={e => setConfig({...config, judul: e.target.value})} className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-1">Durasi (menit)</label>
                  <input type="number" min="1" value={config.durasi_menit} onChange={e => setConfig({...config, durasi_menit: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-1">Status</label>
                  <div className="flex gap-2">
                    <button onClick={() => setConfig({...config, status: 'buka'})} className={`flex-1 py-2 rounded-lg font-semibold transition ${config.status === 'buka' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 hover:bg-slate-300'}`}>🟢 BUKA</button>
                    <button onClick={() => setConfig({...config, status: 'tutup'})} className={`flex-1 py-2 rounded-lg font-semibold transition ${config.status === 'tutup' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-200 hover:bg-slate-300'}`}>🔴 TUTUP</button>
                  </div>
                </div>
                <button onClick={() => updateConfig({ judul: config.judul, durasi_menit: config.durasi_menit, status: config.status })} disabled={loading} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-lg shadow-md">💾 Simpan Pengaturan</button>
                <button onClick={hapusUjian} className="w-full text-red-600 text-sm hover:underline">🗑 Hapus ujian ini beserta semua data terkait</button>
              </div>

              <div className="mt-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
                <p className="text-sm font-semibold text-amber-900 mb-1">💡 Tips Penggunaan:</p>
                <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                  <li>Set status <strong>BUKA</strong> 5 menit sebelum ujian dimulai</li>
                  <li>Set <strong>TUTUP</strong> setelah ujian selesai untuk mencegah submit susulan</li>
                  <li>Durasi tersimpan per-mahasiswa saat mereka mulai — perubahan tidak mempengaruhi yang sudah berjalan</li>
                </ul>
              </div>
            </div>
          )}

          {editSoal && <EditSoalModal soal={editSoal} onClose={() => setEditSoal(null)} onSave={simpanSoal} />}
          {showImportCSV && <ImportCSVModal onClose={() => setShowImportCSV(false)} onImport={handleFileImport} onDownloadTemplate={downloadTemplate} loading={loading} kodeUjian={kodeUjian} judulUjian={config?.judul} />}
          {showBuatUjian && <BuatUjianModal onClose={() => setShowBuatUjian(false)} onSave={buatUjianBaru} loading={loading} />}
        </div>
      </div>
    )
  }

  return null
}

// ============ MODAL: IMPORT CSV ============
function ImportCSVModal({ onClose, onImport, onDownloadTemplate, loading, kodeUjian, judulUjian }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) { alert('File harus berformat CSV (.csv)'); return }
    onImport(file)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-purple-700 text-white p-4 flex justify-between items-center sticky top-0">
          <h3 className="font-bold">📂 Import Soal dari CSV</h3>
          <button onClick={onClose} className="text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded text-sm">
            <p className="font-semibold text-blue-900 mb-1">📍 Soal akan diimport ke:</p>
            <p className="text-blue-800"><strong>{judulUjian}</strong> ({kodeUjian})</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Langkah Import:</h4>
            <ol className="list-decimal list-inside text-sm space-y-1 text-slate-700">
              <li>Download template CSV</li>
              <li>Buka di Excel/Google Sheets, isi soal-soal</li>
              <li>Save sebagai CSV (UTF-8)</li>
              <li>Upload file di bawah</li>
            </ol>
          </div>

          <button onClick={onDownloadTemplate} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg">📥 Download Template CSV</button>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${dragOver ? 'border-purple-500 bg-purple-50' : 'border-slate-300 hover:border-purple-400'}`}>
            <div className="text-4xl mb-2">📁</div>
            <p className="font-semibold text-slate-700">Klik atau drag file CSV ke sini</p>
            <p className="text-xs text-slate-500 mt-1">Format: .csv (UTF-8)</p>
            <input ref={inputRef} type="file" accept=".csv" onChange={e => handleFile(e.target.files[0])} className="hidden" />
          </div>

          <details className="bg-slate-50 rounded-lg p-3 text-xs">
            <summary className="font-semibold cursor-pointer">📖 Format Kolom CSV (klik untuk detail)</summary>
            <div className="mt-2 space-y-2">
              <p><strong>Kolom wajib:</strong> nomor, topik, bobot, tipe, pertanyaan</p>
              <p><strong>Tipe valid:</strong> mc, dual, numjenis</p>
              <div className="bg-white p-2 rounded font-mono text-xs overflow-x-auto">
                <p>• <strong>mc</strong>: isi opsi_A, opsi_B, opsi_C, opsi_D, benar</p>
                <p>• <strong>dual</strong>: isi input1_label, satuan, benar, tol, poin</p>
                <p>• <strong>numjenis</strong>: numerik + tarik/tekan</p>
              </div>
            </div>
          </details>

          {loading && <div className="text-center text-blue-700 font-semibold">⏳ Mengimport...</div>}
        </div>
      </div>
    </div>
  )
}

// ============ MODAL: BUAT UJIAN ============
function BuatUjianModal({ onClose, onSave, loading }) {
  const [kode, setKode] = useState('')
  const [judul, setJudul] = useState('')
  const [durasi, setDurasi] = useState(120)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="bg-blue-700 text-white p-4 flex justify-between items-center">
          <h3 className="font-bold">+ Buat Ujian Baru</h3>
          <button onClick={onClose} className="text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-sm font-semibold block mb-1">Kode Ujian</label>
            <input type="text" value={kode} onChange={e => setKode(e.target.value.toUpperCase())} placeholder="UTS-MEKTAN-2026" className="w-full px-3 py-2 border-2 rounded-lg uppercase" />
            <p className="text-xs text-slate-500 mt-1">Format huruf besar dengan tanda dash. Contoh: UTS-MEKTAN-2026</p>
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">Judul Ujian</label>
            <input type="text" value={judul} onChange={e => setJudul(e.target.value)} placeholder="UTS Mekanika Tanah" className="w-full px-3 py-2 border-2 rounded-lg" />
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">Durasi (menit)</label>
            <input type="number" value={durasi} onChange={e => setDurasi(e.target.value)} className="w-full px-3 py-2 border-2 rounded-lg" />
          </div>
          <div className="bg-amber-50 p-2 rounded text-xs text-amber-800">
            💡 Status default: <strong>TUTUP</strong>. Aktifkan via tab Pengaturan saat siap.
          </div>
          <button onClick={() => onSave(kode, judul, durasi)} disabled={loading} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded disabled:opacity-50">💾 Buat Ujian</button>
        </div>
      </div>
    </div>
  )
}

// ============ MODAL: EDIT SOAL ============
function EditSoalModal({ soal: initial, onClose, onSave }) {
  const [s, setS] = useState({ ...initial })
  const update = (k, v) => setS(prev => ({ ...prev, [k]: v }))
  const ubahTipe = (tipe) => {
    if (tipe === 'mc') setS({ ...s, tipe, opsi: s.opsi || [{val:'A',text:''},{val:'B',text:''},{val:'C',text:''},{val:'D',text:''}], inputs: null })
    else if (tipe === 'dual') setS({ ...s, tipe, opsi: null, benar: null, inputs: [{ id: 'nilai', label: '', satuan: 'kN', benar: 0, tol: 0.1, poin: s.bobot || 5 }] })
    else if (tipe === 'numjenis') setS({ ...s, tipe, opsi: null, benar: null, inputs: [
      { id: 'nilai', label: '', satuan: 'kN', benar: 0, tol: 0.1, poin: Math.floor((s.bobot || 10)/2) },
      { id: 'jenis', label: 'Jenis:', benar: 'tarik', poin: Math.ceil((s.bobot || 10)/2) }
    ]})
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="bg-blue-700 text-white p-4 flex justify-between items-center sticky top-0">
          <h3 className="font-bold">{s.id ? `Edit Soal #${s.nomor}` : 'Tambah Soal'}</h3>
          <button onClick={onClose} className="text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-semibold">Nomor</label><input type="number" value={s.nomor || ''} onChange={e => update('nomor', e.target.value)} className="w-full px-2 py-1.5 border rounded" /></div>
            <div><label className="text-xs font-semibold">Topik</label><input type="text" value={s.topik} onChange={e => update('topik', e.target.value)} className="w-full px-2 py-1.5 border rounded" /></div>
            <div><label className="text-xs font-semibold">Bobot</label><input type="number" value={s.bobot} onChange={e => update('bobot', parseInt(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded" /></div>
          </div>
          <div><label className="text-xs font-semibold">Tipe</label>
            <select value={s.tipe} onChange={e => ubahTipe(e.target.value)} className="w-full px-2 py-1.5 border rounded">
              <option value="mc">Pilihan Ganda</option><option value="dual">Numerik Tunggal</option><option value="numjenis">Numerik + Tarik/Tekan</option>
            </select>
          </div>
          <div><label className="text-xs font-semibold">Pertanyaan</label>
            <textarea value={s.pertanyaan || ''} onChange={e => update('pertanyaan', e.target.value)} className="w-full px-2 py-1.5 border rounded min-h-20" />
          </div>
          <div><label className="text-xs font-semibold">Figure (opsional)</label>
            <textarea value={s.figure || ''} onChange={e => update('figure', e.target.value)} className="w-full px-2 py-1.5 border rounded font-mono text-xs min-h-16" />
          </div>

          {s.tipe === 'mc' && (
            <div>
              <label className="text-xs font-semibold">Pilihan</label>
              {(s.opsi || []).map((o, idx) => (
                <div key={idx} className="flex gap-2 mb-1">
                  <input value={o.val} onChange={e => { const ops=[...s.opsi]; ops[idx]={...ops[idx],val:e.target.value}; update('opsi',ops) }} className="w-12 px-2 py-1 border rounded text-center" />
                  <input value={o.text} onChange={e => { const ops=[...s.opsi]; ops[idx]={...ops[idx],text:e.target.value}; update('opsi',ops) }} className="flex-1 px-2 py-1 border rounded" />
                  <button onClick={() => update('opsi', s.opsi.filter((_,i) => i !== idx))} className="text-red-600 px-2">×</button>
                </div>
              ))}
              <button onClick={() => update('opsi', [...(s.opsi||[]), { val: String.fromCharCode(65 + (s.opsi?.length||0)), text: '' }])} className="text-xs bg-slate-100 px-2 py-1 rounded">+ Pilihan</button>
              <div className="mt-2"><label className="text-xs font-semibold">Jawaban Benar</label>
                <input value={s.benar || ''} onChange={e => update('benar', e.target.value)} className="w-full px-2 py-1.5 border rounded" />
              </div>
            </div>
          )}

          {s.tipe === 'dual' && s.inputs && s.inputs[0] && (
            <div className="border p-3 rounded bg-slate-50">
              <h4 className="font-semibold text-sm mb-2">Input Numerik</h4>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs">Label</label><input value={s.inputs[0].label} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],label:e.target.value}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                <div><label className="text-xs">Satuan</label><input value={s.inputs[0].satuan} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],satuan:e.target.value}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                <div><label className="text-xs">Jawaban Benar</label><input type="number" step="0.01" value={s.inputs[0].benar} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],benar:parseFloat(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                <div><label className="text-xs">Toleransi</label><input type="number" step="0.01" value={s.inputs[0].tol} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],tol:parseFloat(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                <div className="col-span-2"><label className="text-xs">Poin</label><input type="number" value={s.inputs[0].poin} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],poin:parseInt(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
              </div>
            </div>
          )}

          {s.tipe === 'numjenis' && s.inputs && s.inputs[0] && s.inputs[1] && (
            <>
              <div className="border p-3 rounded bg-slate-50">
                <h4 className="font-semibold text-sm mb-2">Input #1: Nilai Numerik</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">Label</label><input value={s.inputs[0].label} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],label:e.target.value}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                  <div><label className="text-xs">Satuan</label><input value={s.inputs[0].satuan} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],satuan:e.target.value}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                  <div><label className="text-xs">Jawaban Benar</label><input type="number" step="0.01" value={s.inputs[0].benar} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],benar:parseFloat(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                  <div><label className="text-xs">Toleransi</label><input type="number" step="0.01" value={s.inputs[0].tol} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],tol:parseFloat(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                  <div className="col-span-2"><label className="text-xs">Poin</label><input type="number" value={s.inputs[0].poin} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],poin:parseInt(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                </div>
              </div>
              <div className="border p-3 rounded bg-slate-50">
                <h4 className="font-semibold text-sm mb-2">Input #2: Tarik/Tekan</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">Jawaban Benar</label>
                    <select value={s.inputs[1].benar} onChange={e => { const ip=[...s.inputs]; ip[1]={...ip[1],benar:e.target.value}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded">
                      <option value="tarik">tarik</option><option value="tekan">tekan</option>
                    </select>
                  </div>
                  <div><label className="text-xs">Poin</label><input type="number" value={s.inputs[1].poin} onChange={e => { const ip=[...s.inputs]; ip[1]={...ip[1],poin:parseInt(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                </div>
              </div>
            </>
          )}

          <div><label className="text-xs font-semibold">Pembahasan (untuk feedback mahasiswa)</label>
            <textarea value={s.pembahasan || ''} onChange={e => update('pembahasan', e.target.value)} className="w-full px-2 py-1.5 border rounded min-h-16" />
          </div>

          <div className="flex gap-2 pt-3 border-t">
            <button onClick={() => onSave(s)} className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2 rounded">💾 Simpan</button>
            <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded">Batal</button>
          </div>
        </div>
      </div>
    </div>
  )
}
