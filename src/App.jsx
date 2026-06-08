import { useState, useEffect, useRef } from 'react'
import { supabase, ADMIN_PASSWORD } from './supabaseClient'
import { SOAL_AWAL, KODE_UJIAN } from './soalAwal'

// Fisher-Yates shuffle
function shuffle(array) {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Format detik → MM:SS atau HH:MM:SS
function formatWaktu(detik) {
  if (detik < 0) detik = 0
  const h = Math.floor(detik / 3600)
  const m = Math.floor((detik % 3600) / 60)
  const s = detik % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function App() {
  const [mode, setMode] = useState('login')
  const [role, setRole] = useState('mahasiswa')
  const [nama, setNama] = useState('')
  const [nim, setNim] = useState('')
  const [kelas, setKelas] = useState('')
  const [adminPass, setAdminPass] = useState('')
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

  // ===== STATE TIMER & SESI =====
  const [config, setConfig] = useState(null)          // { kode_ujian, judul, durasi_menit, status }
  const [sesi, setSesi] = useState(null)              // { id, waktu_mulai, durasi_menit, pindah_tab_count }
  const [sisaWaktu, setSisaWaktu] = useState(0)       // detik
  const [pindahTab, setPindahTab] = useState(0)
  const [warningTab, setWarningTab] = useState(false)
  const submittedRef = useRef(false)                  // cegah double-submit

  const totalBobot = soalSesi.reduce((s, q) => s + q.bobot, 0)

  // ===== LOAD CONFIG SAAT MOUNT =====
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('konfigurasi_ujian')
          .select('*')
          .eq('kode_ujian', KODE_UJIAN)
          .single()
        if (data) setConfig(data)
      } catch (e) { /* tabel belum ada */ }
    })()
  }, [])

  // ===== TIMER COUNTDOWN =====
  useEffect(() => {
    if (mode !== 'exam' || !sesi) return
    const interval = setInterval(() => {
      const mulai = new Date(sesi.waktu_mulai).getTime()
      const durasiMs = sesi.durasi_menit * 60 * 1000
      const sisa = Math.max(0, Math.floor((mulai + durasiMs - Date.now()) / 1000))
      setSisaWaktu(sisa)
      if (sisa === 0 && !submittedRef.current) {
        submittedRef.current = true
        autoSubmit()
      }
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line
  }, [mode, sesi])

  // ===== DETEKSI PINDAH TAB =====
  useEffect(() => {
    if (mode !== 'exam' || !sesi) return
    const handleVisibility = async () => {
      if (document.hidden) {
        const newCount = pindahTab + 1
        setPindahTab(newCount)
        setWarningTab(true)
        // Update database
        try {
          await supabase
            .from('sesi_ujian')
            .update({ pindah_tab_count: newCount })
            .eq('id', sesi.id)
        } catch (e) { /* abaikan error update */ }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
    // eslint-disable-next-line
  }, [mode, sesi, pindahTab])

  // ===== PERINGATAN SEBELUM TUTUP TAB =====
  useEffect(() => {
    if (mode !== 'exam') return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = 'Anda sedang mengerjakan ujian. Yakin meninggalkan halaman?'
      return e.returnValue
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [mode])

  // ===== MULAI UJIAN =====
  const mulaiUjian = async () => {
    if (!nama || !nim) { alert('Isi nama dan NIM dulu.'); return }
    setLoading(true)
    setError('')
    try {
      // Cek config
      if (!config) {
        setError('Konfigurasi ujian belum dibuat. Hubungi dosen.')
        setLoading(false)
        return
      }
      if (config.status !== 'buka') {
        setError(`Ujian saat ini sedang ${config.status.toUpperCase()}. Hubungi dosen untuk informasi lebih lanjut.`)
        setLoading(false)
        return
      }

      // Cek sudah submit?
      const { data: cek } = await supabase
        .from('hasil_uts')
        .select('id, total_skor, total_bobot, grade, created_at')
        .eq('nim', nim)
        .eq('kode_ujian', KODE_UJIAN)
      if (cek && cek.length > 0) {
        const h = cek[0]
        setError(`NIM ${nim} sudah mengerjakan UTS ini pada ${new Date(h.created_at).toLocaleString('id-ID')}. Skor: ${h.total_skor}/${h.total_bobot} (Grade ${h.grade}). Tidak dapat mengerjakan ulang.`)
        setLoading(false)
        return
      }

      // Cek sesi yang sudah ada (resume?)
      const { data: sesiAda } = await supabase
        .from('sesi_ujian')
        .select('*')
        .eq('nim', nim)
        .eq('kode_ujian', KODE_UJIAN)
        .maybeSingle()

      let sesiAktif
      if (sesiAda && sesiAda.status === 'aktif') {
        // Cek apakah sesi masih valid (belum lewat durasi)
        const mulai = new Date(sesiAda.waktu_mulai).getTime()
        const durasiMs = sesiAda.durasi_menit * 60 * 1000
        const sisa = Math.floor((mulai + durasiMs - Date.now()) / 1000)
        if (sisa <= 0) {
          // Sesi sudah expired tapi belum ada hasil → blokir
          setError('Sesi ujian Anda sudah berakhir. Hubungi dosen jika perlu reset.')
          setLoading(false)
          return
        }
        sesiAktif = sesiAda
        setPindahTab(sesiAda.pindah_tab_count || 0)
      } else {
        // Buat sesi baru
        const { data: sesiBaru, error: errSesi } = await supabase
          .from('sesi_ujian')
          .insert({
            kode_ujian: KODE_UJIAN,
            nim, nama, kelas: kelas || '-',
            durasi_menit: config.durasi_menit,
            status: 'aktif',
            pindah_tab_count: 0
          })
          .select()
          .single()
        if (errSesi) throw errSesi
        sesiAktif = sesiBaru
      }

      // Ambil soal
      const { data: soalDb, error: errSoal } = await supabase
        .from('bank_soal')
        .select('*')
        .eq('kode_ujian', KODE_UJIAN)
        .eq('aktif', true)
        .order('nomor', { ascending: true })
      if (errSoal) throw errSoal
      if (!soalDb || soalDb.length === 0) {
        setError('Belum ada soal di database. Hubungi dosen.')
        setLoading(false)
        return
      }

      // Acak urutan + pilihan
      const acak = shuffle(soalDb).map(s => {
        if (s.tipe === 'mc' && Array.isArray(s.opsi)) {
          return { ...s, opsi: shuffle(s.opsi) }
        }
        return s
      })

      setSoalSesi(acak)
      setSesi(sesiAktif)
      submittedRef.current = false
      setMode('exam')
    } catch (e) {
      setError('Gagal memuat: ' + e.message)
    }
    setLoading(false)
  }

  const cekJawaban = (soal) => {
    const j = jawaban[soal.id] || {}
    let s = 0, pesan = []

    if (soal.tipe === 'mc') {
      if (!j.pilihan) { alert('Pilih jawaban dulu.'); return }
      if (j.pilihan === soal.benar) { s = soal.bobot; pesan.push(`✅ BENAR! Skor: ${s}/${soal.bobot}`) }
      else pesan.push(`❌ Kurang tepat. Jawaban benar: ${soal.benar}. Skor: 0/${soal.bobot}`)
    } else if (soal.tipe === 'dual') {
      const inp = soal.inputs[0]
      const val = parseFloat(j[inp.id])
      if (isNaN(val)) { alert('Isi nilai dulu.'); return }
      if (Math.abs(val - inp.benar) <= inp.tol) { s = inp.poin; pesan.push(`✅ BENAR! Skor: ${s}/${soal.bobot}`) }
      else pesan.push(`❌ Kurang tepat (Anda: ${val}, seharusnya ${inp.benar}). Skor: 0/${soal.bobot}`)
    } else if (soal.tipe === 'numjenis') {
      const inpN = soal.inputs[0], inpJ = soal.inputs[1]
      const val = parseFloat(j[inpN.id])
      const jen = j[inpJ.id]
      if (isNaN(val) || !jen) { alert('Isi nilai dan jenis.'); return }
      if (Math.abs(val - inpN.benar) <= inpN.tol) { s += inpN.poin; pesan.push(`Nilai ✓ (+${inpN.poin})`) }
      else pesan.push(`Nilai ✗ (seharusnya ${inpN.benar})`)
      if (jen === inpJ.benar) { s += inpJ.poin; pesan.push(`Jenis ✓ (+${inpJ.poin})`) }
      else pesan.push(`Jenis ✗ (seharusnya ${inpJ.benar})`)
    }

    setSkor(prev => ({ ...prev, [soal.id]: s }))
    setFeedback(prev => ({
      ...prev,
      [soal.id]: {
        status: s === soal.bobot ? 'correct' : s === 0 ? 'wrong' : 'partial',
        pesan: pesan.join(' • '),
        pembahasan: soal.pembahasan
      }
    }))
  }

  // Hitung & kirim hasil (manual atau auto)
  const kirimHasil = async (autoSubmitFlag = false) => {
    if (submittedRef.current && !autoSubmitFlag) return
    submittedRef.current = true

    const totalSkor = Object.values(skor).reduce((a, b) => a + b, 0)
    const persen = parseFloat((totalSkor / Math.max(totalBobot, 1) * 100).toFixed(1))
    let grade
    if (totalSkor >= 0.8 * totalBobot) grade = 'A'
    else if (totalSkor >= 0.7 * totalBobot) grade = 'B'
    else if (totalSkor >= 0.6 * totalBobot) grade = 'C'
    else if (totalSkor >= 0.5 * totalBobot) grade = 'D'
    else grade = 'E'

    const durasiPengerjaan = sesi ? Math.floor((Date.now() - new Date(sesi.waktu_mulai).getTime()) / 1000) : null

    setLoading(true)
    try {
      // Insert ke hasil_uts
      const { error: e1 } = await supabase.from('hasil_uts').insert({
        nama, nim, kelas: kelas || '-',
        kode_ujian: KODE_UJIAN,
        total_skor: totalSkor, total_bobot: totalBobot, persen, grade,
        jumlah_dijawab: Object.keys(skor).length,
        detail: skor,
        pindah_tab_count: pindahTab,
        durasi_pengerjaan_detik: durasiPengerjaan,
        auto_submit: autoSubmitFlag
      })
      if (e1) throw e1

      // Update sesi → selesai
      if (sesi) {
        await supabase
          .from('sesi_ujian')
          .update({
            waktu_selesai: new Date().toISOString(),
            status: autoSubmitFlag ? 'expired' : 'selesai',
            pindah_tab_count: pindahTab
          })
          .eq('id', sesi.id)
      }
      setMode('done')
    } catch (e) {
      alert('Gagal mengirim: ' + e.message)
      submittedRef.current = false
    }
    setLoading(false)
  }

  const submitHasil = () => kirimHasil(false)
  const autoSubmit = () => kirimHasil(true)

  // ============ ADMIN: load semua data ============
  const loadDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      const [hasilRes, soalRes, configRes] = await Promise.all([
        supabase.from('hasil_uts').select('*').eq('kode_ujian', KODE_UJIAN).order('created_at', { ascending: false }),
        supabase.from('bank_soal').select('*').eq('kode_ujian', KODE_UJIAN).order('nomor', { ascending: true }),
        supabase.from('konfigurasi_ujian').select('*').eq('kode_ujian', KODE_UJIAN).single()
      ])
      if (hasilRes.error) throw hasilRes.error
      if (soalRes.error) throw soalRes.error
      setHasilSemua(hasilRes.data || [])
      setBankSoal(soalRes.data || [])
      if (configRes.data) setConfig(configRes.data)
    } catch (e) { setError('Gagal memuat: ' + e.message) }
    setLoading(false)
  }

  const updateConfig = async (patch) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('konfigurasi_ujian')
        .update(patch)
        .eq('kode_ujian', KODE_UJIAN)
        .select()
        .single()
      if (error) throw error
      setConfig(data)
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  const resetSesiNim = async (nim) => {
    if (!confirm(`Reset sesi NIM ${nim}? Mahasiswa bisa mulai ulang dari awal.`)) return
    setLoading(true)
    try {
      await supabase.from('sesi_ujian').delete().eq('nim', nim).eq('kode_ujian', KODE_UJIAN)
      await supabase.from('hasil_uts').delete().eq('nim', nim).eq('kode_ujian', KODE_UJIAN)
      await loadDashboard()
      alert('Sesi dan hasil direset. Mahasiswa bisa mulai ulang.')
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  const hapusSemuaHasil = async () => {
    if (!confirm('Yakin hapus SEMUA hasil + sesi mahasiswa?')) return
    setLoading(true)
    try {
      await supabase.from('hasil_uts').delete().eq('kode_ujian', KODE_UJIAN)
      await supabase.from('sesi_ujian').delete().eq('kode_ujian', KODE_UJIAN)
      setHasilSemua([])
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  const hapusHasilNim = async (id, nim) => {
    if (!confirm(`Hapus hasil NIM ${nim}? Mahasiswa akan bisa mengerjakan ulang.`)) return
    setLoading(true)
    try {
      await supabase.from('hasil_uts').delete().eq('id', id)
      await supabase.from('sesi_ujian').delete().eq('nim', nim).eq('kode_ujian', KODE_UJIAN)
      setHasilSemua(prev => prev.filter(h => h.id !== id))
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  const importSoalAwal = async () => {
    if (bankSoal.length > 0) {
      if (!confirm('Bank soal sudah berisi data. Tambah 18 soal awal?')) return
    }
    setLoading(true)
    try {
      const data = SOAL_AWAL.map(s => ({ ...s, kode_ujian: KODE_UJIAN, aktif: true }))
      const { error } = await supabase.from('bank_soal').insert(data)
      if (error) throw error
      await loadDashboard()
      alert(`Berhasil import ${data.length} soal!`)
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  const toggleAktif = async (soal) => {
    try {
      await supabase.from('bank_soal').update({ aktif: !soal.aktif }).eq('id', soal.id)
      setBankSoal(prev => prev.map(s => s.id === soal.id ? { ...s, aktif: !s.aktif } : s))
    } catch (e) { alert(e.message) }
  }

  const hapusSoal = async (id) => {
    if (!confirm('Hapus soal ini permanen?')) return
    try {
      await supabase.from('bank_soal').delete().eq('id', id)
      setBankSoal(prev => prev.filter(s => s.id !== id))
    } catch (e) { alert(e.message) }
  }

  const simpanSoal = async (soal) => {
    setLoading(true)
    try {
      const payload = {
        nomor: parseInt(soal.nomor) || null,
        topik: soal.topik, bobot: parseInt(soal.bobot) || 5,
        tipe: soal.tipe, pertanyaan: soal.pertanyaan,
        figure: soal.figure || null, opsi: soal.opsi || null,
        benar: soal.benar || null, inputs: soal.inputs || null,
        pembahasan: soal.pembahasan || null,
        kode_ujian: KODE_UJIAN, aktif: soal.aktif !== false
      }
      if (soal.id) await supabase.from('bank_soal').update(payload).eq('id', soal.id)
      else await supabase.from('bank_soal').insert(payload)
      await loadDashboard()
      setEditSoal(null)
    } catch (e) { alert(e.message) }
    setLoading(false)
  }

  const exportCSV = () => {
    if (hasilSemua.length === 0) return
    const header = 'Waktu,Nama,NIM,Kelas,Skor,Total,Persen,Grade,Pindah Tab,Durasi (menit),Auto Submit\n'
    const rows = hasilSemua.map(h => {
      const durMenit = h.durasi_pengerjaan_detik ? (h.durasi_pengerjaan_detik/60).toFixed(1) : '-'
      return `${new Date(h.created_at).toLocaleString('id-ID')},"${h.nama}",${h.nim},${h.kelas},${h.total_skor},${h.total_bobot},${h.persen}%,${h.grade},${h.pindah_tab_count||0},${durMenit},${h.auto_submit ? 'Ya' : 'Tidak'}`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Nilai_UTS_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  // ============ LOGIN ============
  if (mode === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6 text-center">
            <h1 className="text-2xl font-bold">UTS Interaktif</h1>
            <p className="text-sm opacity-90 mt-1">{config?.judul || 'Analisis Struktur Rangka Batang'}</p>
            {config && (
              <div className="flex items-center justify-center gap-3 mt-3 text-xs">
                <span>⏱️ {config.durasi_menit} menit</span>
                <span className={`px-2 py-0.5 rounded-full font-bold ${config.status==='buka' ? 'bg-green-500' : 'bg-red-500'}`}>
                  {config.status === 'buka' ? '🟢 BUKA' : '🔴 TUTUP'}
                </span>
              </div>
            )}
          </div>
          <div className="p-6">
            <div className="flex gap-2 mb-4">
              <button onClick={() => setRole('mahasiswa')} className={`flex-1 py-2 rounded-lg font-semibold ${role==='mahasiswa' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>👨‍🎓 Mahasiswa</button>
              <button onClick={() => setRole('dosen')} className={`flex-1 py-2 rounded-lg font-semibold ${role==='dosen' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>👨‍🏫 Dosen</button>
            </div>

            {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-3 mb-3 text-sm rounded">{error}</div>}

            {role === 'mahasiswa' ? (
              <div className="space-y-3">
                <input className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg" placeholder="Nama Lengkap" value={nama} onChange={e=>setNama(e.target.value)} />
                <input className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg" placeholder="NIM" value={nim} onChange={e=>setNim(e.target.value)} />
                <input className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg" placeholder="Kelas / Kelompok" value={kelas} onChange={e=>setKelas(e.target.value)} />
                <button onClick={mulaiUjian} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-slate-400 text-white font-bold py-3 rounded-lg">
                  {loading ? 'Memuat...' : '⏱️ Mulai Ujian'}
                </button>
                <div className="text-xs bg-amber-50 border-l-4 border-amber-500 p-2 rounded space-y-1">
                  <p className="font-semibold text-amber-900">⚠️ Peraturan Ujian:</p>
                  <p className="text-amber-800">• Setiap NIM hanya bisa mengerjakan SATU kali</p>
                  <p className="text-amber-800">• Timer mulai berjalan begitu klik "Mulai Ujian"</p>
                  <p className="text-amber-800">• Pindah tab/window akan tercatat di sistem</p>
                  <p className="text-amber-800">• Saat waktu habis, jawaban otomatis dikirim</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input type="password" className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg" placeholder="Password Dosen" value={adminPass} onChange={e=>setAdminPass(e.target.value)} />
                <button onClick={async () => {
                  if (adminPass !== ADMIN_PASSWORD) { alert('Password salah.'); return }
                  await loadDashboard()
                  setMode('dashboard')
                }} className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-lg">Masuk Dashboard</button>
              </div>
            )}
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
    const warna = sisaMenit > 30 ? 'bg-green-600' : sisaMenit > 10 ? 'bg-amber-500' : 'bg-red-600 animate-pulse'

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header sticky dengan timer */}
          <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-5 sticky top-0 z-10">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex-1 min-w-0">
                <h1 className="text-lg md:text-xl font-bold truncate">UTS Analisis Struktur Rangka Batang</h1>
                <p className="text-xs opacity-90">{nama} • NIM {nim} • {kelas}</p>
              </div>
              {/* TIMER */}
              <div className={`${warna} text-white px-4 py-2 rounded-lg shadow-lg`}>
                <div className="text-xs opacity-90 text-center">SISA WAKTU</div>
                <div className="text-2xl font-bold font-mono text-center">{formatWaktu(sisaWaktu)}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-between items-center text-xs">
              <span>Dijawab: <strong>{dijawab}/{soalSesi.length}</strong></span>
              <span>Bobot Total: {totalBobot} poin</span>
              {pindahTab > 0 && <span className="bg-red-500 px-2 py-0.5 rounded-full font-bold">⚠️ Pindah tab: {pindahTab}x</span>}
            </div>
            <div className="mt-2 h-1.5 bg-blue-950 rounded-full overflow-hidden">
              <div className="h-full bg-green-400 transition-all" style={{width: `${progress}%`}}></div>
            </div>
          </div>

          {/* Modal warning pindah tab */}
          {warningTab && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl max-w-md w-full p-6 text-center">
                <div className="text-5xl mb-3">⚠️</div>
                <h3 className="text-xl font-bold text-red-700 mb-2">Peringatan Pindah Tab!</h3>
                <p className="text-slate-700 mb-3">Anda terdeteksi keluar dari halaman ujian. Aktivitas ini tercatat di sistem dan akan dilaporkan ke dosen.</p>
                <p className="text-sm bg-red-50 text-red-800 p-2 rounded mb-4">Jumlah pindah tab Anda saat ini: <strong>{pindahTab}x</strong></p>
                <button onClick={() => setWarningTab(false)} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded">Saya Mengerti</button>
              </div>
            </div>
          )}

          {/* Soal-soal */}
          <div className="p-5 space-y-5">
            {soalSesi.map((soal, idx) => {
              const fb = feedback[soal.id]
              const j = jawaban[soal.id] || {}
              const setJ = (key, val) => setJawaban(prev => ({ ...prev, [soal.id]: { ...prev[soal.id], [key]: val } }))

              return (
                <div key={soal.id} className="border-2 border-slate-200 rounded-xl p-5">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-blue-700 text-white px-3 py-1 rounded-full text-xs font-bold">SOAL {idx+1}</span>
                    <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs">{soal.topik}</span>
                    <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold">{soal.bobot} poin</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed mb-3">{soal.pertanyaan}</p>

                  {soal.figure && <pre className="bg-slate-50 border-l-4 border-blue-500 p-3 text-xs font-mono whitespace-pre-wrap mb-3 text-slate-700">{soal.figure}</pre>}

                  {soal.tipe === 'mc' && Array.isArray(soal.opsi) && (
                    <div className="space-y-2">
                      {soal.opsi.map(o => (
                        <label key={o.val} className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition
                            ${j.pilihan === o.val ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}
                            ${fb && o.val === soal.benar ? '!border-green-500 !bg-green-50' : ''}
                            ${fb && j.pilihan === o.val && o.val !== soal.benar ? '!border-red-500 !bg-red-50' : ''}`}>
                          <input type="radio" name={'s-' + soal.id} value={o.val} checked={j.pilihan === o.val} onChange={() => setJ('pilihan', o.val)} disabled={!!fb} className="mt-1" />
                          <span className="text-sm"><strong>{o.val}.</strong> {o.text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {soal.tipe === 'dual' && Array.isArray(soal.inputs) && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="font-semibold">{soal.inputs[0].label}</label>
                      <input type="number" step="0.01" value={j[soal.inputs[0].id] || ''} onChange={e => setJ(soal.inputs[0].id, e.target.value)} disabled={!!fb} className="px-3 py-2 border-2 border-slate-300 rounded-lg w-32" />
                      <span className="text-slate-600 font-semibold">{soal.inputs[0].satuan}</span>
                    </div>
                  )}

                  {soal.tipe === 'numjenis' && Array.isArray(soal.inputs) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="font-semibold min-w-24">{soal.inputs[0].label}</label>
                        <input type="number" step="0.01" value={j[soal.inputs[0].id] || ''} onChange={e => setJ(soal.inputs[0].id, e.target.value)} disabled={!!fb} className="px-3 py-2 border-2 border-slate-300 rounded-lg w-32" />
                        <span className="text-slate-600 font-semibold">{soal.inputs[0].satuan}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="font-semibold min-w-24">{soal.inputs[1].label}</label>
                        <select value={j[soal.inputs[1].id] || ''} onChange={e => setJ(soal.inputs[1].id, e.target.value)} disabled={!!fb} className="px-3 py-2 border-2 border-slate-300 rounded-lg">
                          <option value="">-- pilih --</option>
                          <option value="tarik">Tarik (+)</option>
                          <option value="tekan">Tekan (−)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {!fb && <button onClick={() => cekJawaban(soal)} className="mt-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2 rounded-lg">Cek Jawaban</button>}

                  {fb && (
                    <div className={`mt-3 p-4 rounded-lg border-l-4
                      ${fb.status === 'correct' ? 'bg-green-50 border-green-500 text-green-900' : ''}
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
              <p className="text-slate-600 mb-3">Selesai sebelum waktu habis? Kirim hasil sekarang.</p>
              <p className="text-xs text-red-700 mb-2 font-semibold">⚠️ Tidak dapat mengulang setelah dikirim!</p>
              <p className="text-xs text-slate-500 mb-4">Skor sementara: <strong className="text-2xl text-blue-700">{Object.values(skor).reduce((a,b)=>a+b,0)}/{totalBobot}</strong></p>
              <button onClick={submitHasil} disabled={loading || Object.keys(skor).length === 0} className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:bg-slate-400 text-white font-bold px-8 py-3 rounded-lg shadow-lg">
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
    let grade, gradeColor
    if (total >= 0.8*totalBobot) { grade = 'A'; gradeColor = 'bg-green-600' }
    else if (total >= 0.7*totalBobot) { grade = 'B'; gradeColor = 'bg-blue-600' }
    else if (total >= 0.6*totalBobot) { grade = 'C'; gradeColor = 'bg-amber-500' }
    else if (total >= 0.5*totalBobot) { grade = 'D'; gradeColor = 'bg-orange-600' }
    else { grade = 'E'; gradeColor = 'bg-red-600' }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-8 text-center">
            <div className="text-5xl mb-3">{sisaWaktu === 0 ? '⏰' : '🎓'}</div>
            <h2 className="text-2xl font-bold mb-1">{sisaWaktu === 0 ? 'Waktu Habis' : 'Ujian Selesai'}</h2>
            <p className="text-sm opacity-90">{nama} • NIM {nim}</p>
            <div className="text-6xl font-bold my-5">{total}<span className="text-2xl opacity-75">/{totalBobot}</span></div>
            <div className={`inline-block ${gradeColor} px-6 py-2 rounded-full text-xl font-bold`}>Nilai: {grade}</div>
            <p className="mt-3 text-sm">Persentase: <strong>{persen}%</strong></p>
            {pindahTab > 0 && <p className="mt-2 text-xs bg-red-500 inline-block px-3 py-1 rounded-full">Pindah tab tercatat: {pindahTab}x</p>}
          </div>
          <div className="p-6 text-center space-y-3">
            <p className="text-green-700 font-semibold">✅ Hasil terkirim ke dosen</p>
            <button onClick={() => window.location.reload()} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-lg">Selesai</button>
          </div>
        </div>
      </div>
    )
  }

  // ============ DASHBOARD ============
  if (mode === 'dashboard') {
    const rata = hasilSemua.length > 0 ? (hasilSemua.reduce((s,h) => s + parseFloat(h.total_skor), 0) / hasilSemua.length).toFixed(1) : 0
    const gradeCount = { A: 0, B: 0, C: 0, D: 0, E: 0 }
    hasilSemua.forEach(h => gradeCount[h.grade]++)
    const aktifCount = bankSoal.filter(s => s.aktif).length
    const pindahTabCount = hasilSemua.filter(h => (h.pindah_tab_count || 0) > 0).length
    const autoSubmitCount = hasilSemua.filter(h => h.auto_submit).length

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 p-4">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-5">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold">📊 Dashboard Dosen</h1>
                <p className="text-sm opacity-90">{config?.judul} • {KODE_UJIAN}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={loadDashboard} className="bg-white text-green-800 font-semibold px-4 py-2 rounded-lg">🔄 Refresh</button>
                <button onClick={() => setMode('login')} className="bg-green-900 text-white font-semibold px-4 py-2 rounded-lg">Keluar</button>
              </div>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-800 p-3 text-sm">{error}</div>}

          {/* TABS */}
          <div className="flex border-b overflow-x-auto">
            <button onClick={() => setAdminTab('hasil')} className={`px-6 py-3 font-semibold whitespace-nowrap ${adminTab==='hasil' ? 'border-b-2 border-green-700 text-green-700' : 'text-slate-600'}`}>📋 Hasil ({hasilSemua.length})</button>
            <button onClick={() => setAdminTab('soal')} className={`px-6 py-3 font-semibold whitespace-nowrap ${adminTab==='soal' ? 'border-b-2 border-green-700 text-green-700' : 'text-slate-600'}`}>📚 Bank Soal ({bankSoal.length})</button>
            <button onClick={() => setAdminTab('config')} className={`px-6 py-3 font-semibold whitespace-nowrap ${adminTab==='config' ? 'border-b-2 border-green-700 text-green-700' : 'text-slate-600'}`}>⚙️ Pengaturan</button>
          </div>

          {/* ==== TAB HASIL ==== */}
          {adminTab === 'hasil' && (
            <>
              <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-3 border-b">
                <div className="bg-blue-50 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-blue-700">{hasilSemua.length}</div><div className="text-xs text-blue-900 mt-1">Total Peserta</div></div>
                <div className="bg-green-50 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-green-700">{rata}</div><div className="text-xs text-green-900 mt-1">Rata-rata</div></div>
                <div className="bg-amber-50 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-amber-700">{gradeCount.A + gradeCount.B}</div><div className="text-xs text-amber-900 mt-1">Lulus (A/B)</div></div>
                <div className="bg-red-50 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-red-700">{pindahTabCount}</div><div className="text-xs text-red-900 mt-1">Pernah Pindah Tab</div></div>
                <div className="bg-orange-50 rounded-xl p-4 text-center"><div className="text-3xl font-bold text-orange-700">{autoSubmitCount}</div><div className="text-xs text-orange-900 mt-1">Auto-Submit</div></div>
              </div>

              <div className="p-5 border-b">
                <h3 className="font-bold text-slate-700 mb-3">Distribusi Nilai</h3>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(gradeCount).map(([g, c]) => (
                    <div key={g} className="flex-1 min-w-20 bg-slate-100 rounded-lg p-3 text-center">
                      <div className="font-bold text-2xl">{g}</div>
                      <div className="text-sm text-slate-600">{c} orang</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5">
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                  <h3 className="font-bold text-slate-700">Daftar Nilai</h3>
                  <div className="flex gap-2">
                    <button onClick={exportCSV} disabled={hasilSemua.length===0} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200 disabled:opacity-50">📥 Export CSV</button>
                    <button onClick={hapusSemuaHasil} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200">🗑 Hapus Semua</button>
                  </div>
                </div>
                {hasilSemua.length === 0 ? <p className="text-center py-10 text-slate-500">Belum ada submission.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="p-2 text-left">No</th>
                          <th className="p-2 text-left">Nama</th>
                          <th className="p-2 text-left">NIM</th>
                          <th className="p-2 text-center">Skor</th>
                          <th className="p-2 text-center">%</th>
                          <th className="p-2 text-center">Grade</th>
                          <th className="p-2 text-center">⏱ Durasi</th>
                          <th className="p-2 text-center">⚠️ Tab</th>
                          <th className="p-2 text-center">Auto</th>
                          <th className="p-2 text-left">Waktu</th>
                          <th className="p-2 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hasilSemua.map((h, i) => {
                          const dur = h.durasi_pengerjaan_detik
                          const tab = h.pindah_tab_count || 0
                          return (
                            <tr key={h.id} className={`border-b hover:bg-slate-50 ${tab > 2 ? 'bg-red-50' : ''}`}>
                              <td className="p-2">{i+1}</td>
                              <td className="p-2 font-semibold">{h.nama}</td>
                              <td className="p-2 font-mono text-xs">{h.nim}</td>
                              <td className="p-2 text-center font-bold">{h.total_skor}/{h.total_bobot}</td>
                              <td className="p-2 text-center">{h.persen}%</td>
                              <td className="p-2 text-center">
                                <span className={`inline-block px-2 py-1 rounded text-white text-xs font-bold
                                  ${h.grade==='A'?'bg-green-600':''}${h.grade==='B'?'bg-blue-600':''}
                                  ${h.grade==='C'?'bg-amber-500':''}${h.grade==='D'?'bg-orange-600':''}
                                  ${h.grade==='E'?'bg-red-600':''}`}>{h.grade}</span>
                              </td>
                              <td className="p-2 text-center text-xs">{dur ? `${(dur/60).toFixed(0)}m` : '-'}</td>
                              <td className="p-2 text-center">
                                {tab > 0 ? <span className={`px-2 py-0.5 rounded text-xs font-bold ${tab > 2 ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>{tab}x</span> : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="p-2 text-center text-xs">{h.auto_submit ? '⏰' : '✓'}</td>
                              <td className="p-2 text-xs text-slate-600">{new Date(h.created_at).toLocaleString('id-ID')}</td>
                              <td className="p-2 text-center">
                                <button onClick={() => hapusHasilNim(h.id, h.nim)} className="text-xs text-red-600 hover:underline">🔄</button>
                              </td>
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

          {/* ==== TAB BANK SOAL ==== */}
          {adminTab === 'soal' && (
            <div className="p-5">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-700">Bank Soal — {KODE_UJIAN}</h3>
                  <p className="text-xs text-slate-500">Aktif: {aktifCount} • Total bobot aktif: {bankSoal.filter(s=>s.aktif).reduce((a,b)=>a+b.bobot,0)} poin</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setEditSoal({ tipe: 'mc', topik: 'Konsep', bobot: 5, opsi: [{val:'A',text:''},{val:'B',text:''},{val:'C',text:''},{val:'D',text:''}], aktif: true })} className="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-3 py-1.5 rounded">+ Tambah Soal</button>
                  {bankSoal.length === 0 && <button onClick={importSoalAwal} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 rounded">📥 Import 18 Soal</button>}
                </div>
              </div>

              {bankSoal.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-slate-500 mb-3">Bank soal masih kosong.</p>
                  <button onClick={importSoalAwal} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg">📥 Import 18 Soal Awal</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {bankSoal.map((s, i) => (
                    <div key={s.id} className={`border-2 rounded-lg p-3 ${s.aktif ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1 mb-1 items-center">
                            <span className="bg-slate-200 px-2 py-0.5 rounded text-xs font-bold">#{s.nomor || i+1}</span>
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{s.topik}</span>
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">{s.bobot}p</span>
                            <span className="text-xs text-slate-500">{s.tipe}</span>
                            {!s.aktif && <span className="bg-slate-300 px-2 py-0.5 rounded text-xs">NON-AKTIF</span>}
                          </div>
                          <p className="text-sm text-slate-800 line-clamp-2">{s.pertanyaan}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => toggleAktif(s)} className={`text-xs px-2 py-1 rounded ${s.aktif ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{s.aktif ? '⏸' : '▶'}</button>
                          <button onClick={() => setEditSoal(s)} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">✏️</button>
                          <button onClick={() => hapusSoal(s.id)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">🗑</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==== TAB PENGATURAN ==== */}
          {adminTab === 'config' && config && (
            <div className="p-5 max-w-xl">
              <h3 className="font-bold text-slate-700 mb-4">⚙️ Pengaturan Ujian</h3>

              <div className="space-y-4 bg-slate-50 p-5 rounded-xl">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Judul Ujian</label>
                  <input type="text" value={config.judul} onChange={e => setConfig({...config, judul: e.target.value})} className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg" />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Durasi (menit)</label>
                  <input type="number" min="1" value={config.durasi_menit} onChange={e => setConfig({...config, durasi_menit: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg" />
                  <p className="text-xs text-slate-500 mt-1">Berlaku untuk semua mahasiswa yang mulai ujian setelah perubahan disimpan.</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Status Ujian</label>
                  <div className="flex gap-2">
                    <button onClick={() => setConfig({...config, status: 'buka'})} className={`flex-1 py-2 rounded-lg font-semibold ${config.status === 'buka' ? 'bg-green-600 text-white' : 'bg-slate-200'}`}>🟢 BUKA</button>
                    <button onClick={() => setConfig({...config, status: 'tutup'})} className={`flex-1 py-2 rounded-lg font-semibold ${config.status === 'tutup' ? 'bg-red-600 text-white' : 'bg-slate-200'}`}>🔴 TUTUP</button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Saat status TUTUP, mahasiswa tidak bisa mulai ujian baru. Sesi yang sudah berjalan tetap lanjut.</p>
                </div>

                <button onClick={() => updateConfig({
                  judul: config.judul,
                  durasi_menit: config.durasi_menit,
                  status: config.status
                })} disabled={loading} className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-lg">
                  💾 Simpan Pengaturan
                </button>
              </div>

              <div className="mt-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
                <p className="text-sm font-semibold text-amber-900 mb-1">💡 Tips Penggunaan:</p>
                <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                  <li>Atur status <strong>BUKA</strong> 5 menit sebelum jadwal ujian</li>
                  <li>Setelah semua mahasiswa selesai, set <strong>TUTUP</strong> untuk mencegah submit susulan</li>
                  <li>Durasi disnapshot saat mahasiswa mulai — perubahan durasi tidak mempengaruhi sesi yang sudah berjalan</li>
                </ul>
              </div>
            </div>
          )}

          {/* MODAL EDIT SOAL */}
          {editSoal && <EditSoalModal soal={editSoal} onClose={() => setEditSoal(null)} onSave={simpanSoal} />}
        </div>
      </div>
    )
  }

  return null
}

// ============ MODAL EDIT SOAL ============
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
          <h3 className="font-bold">{s.id ? `Edit Soal #${s.nomor}` : 'Tambah Soal Baru'}</h3>
          <button onClick={onClose} className="text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-semibold">Nomor</label><input type="number" value={s.nomor || ''} onChange={e => update('nomor', e.target.value)} className="w-full px-2 py-1.5 border rounded" /></div>
            <div><label className="text-xs font-semibold">Topik</label>
              <select value={s.topik} onChange={e => update('topik', e.target.value)} className="w-full px-2 py-1.5 border rounded">
                <option>Konsep</option><option>Titik Buhul</option><option>Ritter</option><option>Aplikasi</option>
              </select>
            </div>
            <div><label className="text-xs font-semibold">Bobot</label><input type="number" value={s.bobot} onChange={e => update('bobot', parseInt(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded" /></div>
          </div>

          <div><label className="text-xs font-semibold">Tipe</label>
            <select value={s.tipe} onChange={e => ubahTipe(e.target.value)} className="w-full px-2 py-1.5 border rounded">
              <option value="mc">Pilihan Ganda</option>
              <option value="dual">Input Numerik</option>
              <option value="numjenis">Numerik + Tarik/Tekan</option>
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
                <div><label className="text-xs">Benar</label><input type="number" step="0.01" value={s.inputs[0].benar} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],benar:parseFloat(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                <div><label className="text-xs">Toleransi</label><input type="number" step="0.01" value={s.inputs[0].tol} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],tol:parseFloat(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                <div className="col-span-2"><label className="text-xs">Poin</label><input type="number" value={s.inputs[0].poin} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],poin:parseInt(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
              </div>
            </div>
          )}

          {s.tipe === 'numjenis' && s.inputs && s.inputs[0] && s.inputs[1] && (
            <>
              <div className="border p-3 rounded bg-slate-50">
                <h4 className="font-semibold text-sm mb-2">Input #1: Nilai</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">Label</label><input value={s.inputs[0].label} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],label:e.target.value}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                  <div><label className="text-xs">Satuan</label><input value={s.inputs[0].satuan} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],satuan:e.target.value}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                  <div><label className="text-xs">Benar</label><input type="number" step="0.01" value={s.inputs[0].benar} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],benar:parseFloat(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                  <div><label className="text-xs">Toleransi</label><input type="number" step="0.01" value={s.inputs[0].tol} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],tol:parseFloat(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                  <div className="col-span-2"><label className="text-xs">Poin</label><input type="number" value={s.inputs[0].poin} onChange={e => { const ip=[...s.inputs]; ip[0]={...ip[0],poin:parseInt(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                </div>
              </div>
              <div className="border p-3 rounded bg-slate-50">
                <h4 className="font-semibold text-sm mb-2">Input #2: Tarik/Tekan</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">Benar</label>
                    <select value={s.inputs[1].benar} onChange={e => { const ip=[...s.inputs]; ip[1]={...ip[1],benar:e.target.value}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded">
                      <option value="tarik">tarik</option><option value="tekan">tekan</option>
                    </select>
                  </div>
                  <div><label className="text-xs">Poin</label><input type="number" value={s.inputs[1].poin} onChange={e => { const ip=[...s.inputs]; ip[1]={...ip[1],poin:parseInt(e.target.value)}; update('inputs',ip) }} className="w-full px-2 py-1 border rounded" /></div>
                </div>
              </div>
            </>
          )}

          <div><label className="text-xs font-semibold">Pembahasan</label>
            <textarea value={s.pembahasan || ''} onChange={e => update('pembahasan', e.target.value)} className="w-full px-2 py-1.5 border rounded min-h-16" />
          </div>

          <div className="flex gap-2 pt-3 border-t">
            <button onClick={() => onSave(s)} className="flex-1 bg-green-700 hover:bg-green-800 text-white font-semibold py-2 rounded">💾 Simpan</button>
            <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded">Batal</button>
          </div>
        </div>
      </div>
    </div>
  )
}
