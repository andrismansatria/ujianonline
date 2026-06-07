import { useState, useEffect } from 'react'
import { supabase, ADMIN_PASSWORD } from './supabaseClient'
import { SOAL } from './soal'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalBobot = SOAL.reduce((s, q) => s + q.bobot, 0)

  // Load semua hasil dari Supabase
  const loadDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('hasil_uts')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setHasilSemua(data || [])
    } catch (e) {
      setError('Gagal memuat data: ' + e.message)
    }
    setLoading(false)
  }

  const cekJawaban = (soal) => {
    const j = jawaban[soal.id] || {}
    let s = 0, pesan = []

    if (soal.tipe === 'mc') {
      if (!j.pilihan) { alert('Pilih jawaban dulu.'); return }
      if (j.pilihan === soal.benar) {
        s = soal.bobot
        pesan.push(`✅ BENAR! Skor: ${s}/${soal.bobot}`)
      } else {
        pesan.push(`❌ Kurang tepat. Jawaban benar: ${soal.benar}. Skor: 0/${soal.bobot}`)
      }
    } else if (soal.tipe === 'dual') {
      const inp = soal.inputs[0]
      const val = parseFloat(j[inp.id])
      if (isNaN(val)) { alert('Isi nilai dulu.'); return }
      if (Math.abs(val - inp.benar) <= inp.tol) {
        s = inp.poin
        pesan.push(`✅ BENAR! Skor: ${s}/${soal.bobot}`)
      } else {
        pesan.push(`❌ Kurang tepat (Anda: ${val}, seharusnya ${inp.benar}). Skor: 0/${soal.bobot}`)
      }
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

  const submitHasil = async () => {
    if (!nama || !nim) { alert('Nama dan NIM wajib diisi.'); return }
    const totalSkor = Object.values(skor).reduce((a, b) => a + b, 0)
    const persen = parseFloat((totalSkor / totalBobot * 100).toFixed(1))
    let grade
    if (totalSkor >= 0.8 * totalBobot) grade = 'A'
    else if (totalSkor >= 0.7 * totalBobot) grade = 'B'
    else if (totalSkor >= 0.6 * totalBobot) grade = 'C'
    else if (totalSkor >= 0.5 * totalBobot) grade = 'D'
    else grade = 'E'

    setLoading(true)
    try {
      const { error } = await supabase.from('hasil_uts').insert({
        nama, nim, kelas: kelas || '-',
        total_skor: totalSkor,
        total_bobot: totalBobot,
        persen, grade,
        jumlah_dijawab: Object.keys(skor).length,
        detail: skor
      })
      if (error) throw error
      setMode('done')
    } catch (e) {
      alert('Gagal mengirim: ' + e.message)
    }
    setLoading(false)
  }

  const hapusSemuaData = async () => {
    if (!confirm('Yakin hapus SEMUA data nilai? Tidak bisa dibatalkan.')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('hasil_uts').delete().neq('id', 0)
      if (error) throw error
      setHasilSemua([])
      alert('Data berhasil dihapus.')
    } catch (e) {
      alert('Gagal hapus: ' + e.message)
    }
    setLoading(false)
  }

  const exportCSV = () => {
    if (hasilSemua.length === 0) return
    const header = 'Waktu,Nama,NIM,Kelas,Skor,Total,Persen,Grade\n'
    const rows = hasilSemua.map(h =>
      `${new Date(h.created_at).toLocaleString('id-ID')},"${h.nama}",${h.nim},${h.kelas},${h.total_skor},${h.total_bobot},${h.persen}%,${h.grade}`
    ).join('\n')
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
            <p className="text-sm opacity-90 mt-1">Analisis Struktur Rangka Batang</p>
            <p className="text-xs opacity-75 mt-2">Teknik Sipil • Semester Genap 2025/2026</p>
          </div>
          <div className="p-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setRole('mahasiswa')}
                className={`flex-1 py-2 rounded-lg font-semibold ${role==='mahasiswa' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                👨‍🎓 Mahasiswa
              </button>
              <button
                onClick={() => setRole('dosen')}
                className={`flex-1 py-2 rounded-lg font-semibold ${role==='dosen' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                👨‍🏫 Dosen
              </button>
            </div>

            {role === 'mahasiswa' ? (
              <div className="space-y-3">
                <input className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg" placeholder="Nama Lengkap" value={nama} onChange={e=>setNama(e.target.value)} />
                <input className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg" placeholder="NIM" value={nim} onChange={e=>setNim(e.target.value)} />
                <input className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg" placeholder="Kelas / Kelompok" value={kelas} onChange={e=>setKelas(e.target.value)} />
                <button
                  onClick={() => {
                    if (!nama || !nim) { alert('Isi nama dan NIM dulu.'); return }
                    setMode('exam')
                  }}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-lg">
                  Mulai Ujian
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="password"
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg"
                  placeholder="Password Dosen"
                  value={adminPass}
                  onChange={e=>setAdminPass(e.target.value)} />
                <button
                  onClick={async () => {
                    if (adminPass !== ADMIN_PASSWORD) { alert('Password salah.'); return }
                    await loadDashboard()
                    setMode('dashboard')
                  }}
                  className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-lg">
                  Masuk Dashboard
                </button>
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
    const progress = (dijawab / SOAL.length * 100)

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-5 sticky top-0 z-10">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h1 className="text-xl font-bold">UTS Analisis Struktur Rangka Batang</h1>
                <p className="text-xs opacity-90">{nama} • NIM {nim} • {kelas || 'kelas?'}</p>
              </div>
              <div className="text-right">
                <div className="text-sm">Dijawab: <strong>{dijawab}/{SOAL.length}</strong></div>
                <div className="text-xs opacity-90">Bobot: {totalBobot} poin</div>
              </div>
            </div>
            <div className="mt-3 h-2 bg-blue-950 rounded-full overflow-hidden">
              <div className="h-full bg-green-400 transition-all" style={{width: `${progress}%`}}></div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {SOAL.map((soal, idx) => {
              const fb = feedback[soal.id]
              const j = jawaban[soal.id] || {}
              const setJ = (key, val) => setJawaban(prev => ({
                ...prev,
                [soal.id]: { ...prev[soal.id], [key]: val }
              }))

              return (
                <div key={soal.id} className="border-2 border-slate-200 rounded-xl p-5">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-blue-700 text-white px-3 py-1 rounded-full text-xs font-bold">SOAL {idx+1}</span>
                    <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs">{soal.topik}</span>
                    <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold">Bobot: {soal.bobot} poin</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed mb-3">{soal.pertanyaan}</p>

                  {soal.figure && (
                    <pre className="bg-slate-50 border-l-4 border-blue-500 p-3 text-xs font-mono whitespace-pre-wrap mb-3 text-slate-700">{soal.figure}</pre>
                  )}

                  {soal.tipe === 'mc' && (
                    <div className="space-y-2">
                      {soal.opsi.map(o => (
                        <label key={o.val}
                          className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition
                            ${j.pilihan === o.val ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}
                            ${fb && o.val === soal.benar ? '!border-green-500 !bg-green-50' : ''}
                            ${fb && j.pilihan === o.val && o.val !== soal.benar ? '!border-red-500 !bg-red-50' : ''}`}>
                          <input
                            type="radio"
                            name={soal.id}
                            value={o.val}
                            checked={j.pilihan === o.val}
                            onChange={() => setJ('pilihan', o.val)}
                            disabled={!!fb}
                            className="mt-1" />
                          <span className="text-sm"><strong>{o.val}.</strong> {o.text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {soal.tipe === 'dual' && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="font-semibold">{soal.inputs[0].label}</label>
                      <input
                        type="number" step="0.01"
                        value={j[soal.inputs[0].id] || ''}
                        onChange={e => setJ(soal.inputs[0].id, e.target.value)}
                        disabled={!!fb}
                        className="px-3 py-2 border-2 border-slate-300 rounded-lg w-32" />
                      <span className="text-slate-600 font-semibold">{soal.inputs[0].satuan}</span>
                    </div>
                  )}

                  {soal.tipe === 'numjenis' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="font-semibold min-w-24">{soal.inputs[0].label}</label>
                        <input
                          type="number" step="0.01"
                          value={j[soal.inputs[0].id] || ''}
                          onChange={e => setJ(soal.inputs[0].id, e.target.value)}
                          disabled={!!fb}
                          className="px-3 py-2 border-2 border-slate-300 rounded-lg w-32" />
                        <span className="text-slate-600 font-semibold">{soal.inputs[0].satuan}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="font-semibold min-w-24">{soal.inputs[1].label}</label>
                        <select
                          value={j[soal.inputs[1].id] || ''}
                          onChange={e => setJ(soal.inputs[1].id, e.target.value)}
                          disabled={!!fb}
                          className="px-3 py-2 border-2 border-slate-300 rounded-lg">
                          <option value="">-- pilih --</option>
                          <option value="tarik">Tarik (+)</option>
                          <option value="tekan">Tekan (−)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {!fb && (
                    <button
                      onClick={() => cekJawaban(soal)}
                      className="mt-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2 rounded-lg">
                      Cek Jawaban
                    </button>
                  )}

                  {fb && (
                    <div className={`mt-3 p-4 rounded-lg border-l-4
                      ${fb.status === 'correct' ? 'bg-green-50 border-green-500 text-green-900' : ''}
                      ${fb.status === 'wrong' ? 'bg-red-50 border-red-500 text-red-900' : ''}
                      ${fb.status === 'partial' ? 'bg-amber-50 border-amber-500 text-amber-900' : ''}`}>
                      <div className="font-semibold text-sm">{fb.pesan}</div>
                      <div className="mt-2 pt-2 border-t border-current border-opacity-20 text-xs">
                        <strong>📘 Pembahasan: </strong>{fb.pembahasan}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            <div className="bg-slate-50 rounded-xl p-6 text-center border-2 border-dashed border-slate-300">
              <p className="text-slate-600 mb-3">Selesai? Kirim hasil ke dosen.</p>
              <p className="text-xs text-slate-500 mb-4">
                Skor sementara: <strong className="text-2xl text-blue-700">{Object.values(skor).reduce((a,b)=>a+b,0)}/{totalBobot}</strong>
              </p>
              <button
                onClick={submitHasil}
                disabled={loading || Object.keys(skor).length === 0}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:bg-slate-400 text-white font-bold px-8 py-3 rounded-lg shadow-lg">
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
    const persen = (total / totalBobot * 100).toFixed(1)
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
            <div className="text-5xl mb-3">🎓</div>
            <h2 className="text-2xl font-bold mb-1">Ujian Selesai</h2>
            <p className="text-sm opacity-90">{nama} • NIM {nim}</p>
            <div className="text-6xl font-bold my-5">{total}<span className="text-2xl opacity-75">/{totalBobot}</span></div>
            <div className={`inline-block ${gradeColor} px-6 py-2 rounded-full text-xl font-bold`}>Nilai: {grade}</div>
            <p className="mt-3 text-sm">Persentase: <strong>{persen}%</strong></p>
          </div>
          <div className="p-6 text-center space-y-3">
            <p className="text-green-700 font-semibold">✅ Hasil terkirim ke dosen</p>
            <button
              onClick={() => { setMode('login'); setJawaban({}); setSkor({}); setFeedback({}); setNama(''); setNim(''); setKelas('') }}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-lg">
              Kembali
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============ DASHBOARD ============
  if (mode === 'dashboard') {
    const rata = hasilSemua.length > 0
      ? (hasilSemua.reduce((s,h) => s + h.total_skor, 0) / hasilSemua.length).toFixed(1)
      : 0
    const gradeCount = { A: 0, B: 0, C: 0, D: 0, E: 0 }
    hasilSemua.forEach(h => gradeCount[h.grade]++)

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 p-4">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-5">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold">📊 Dashboard Dosen</h1>
                <p className="text-sm opacity-90">UTS Analisis Struktur Rangka Batang</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={loadDashboard} className="bg-white text-green-800 font-semibold px-4 py-2 rounded-lg">🔄 Refresh</button>
                <button onClick={exportCSV} disabled={hasilSemua.length===0} className="bg-white text-green-800 font-semibold px-4 py-2 rounded-lg disabled:opacity-50">📥 CSV</button>
                <button onClick={() => setMode('login')} className="bg-green-900 text-white font-semibold px-4 py-2 rounded-lg">Keluar</button>
              </div>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-800 p-3 text-sm">{error}</div>}

          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3 border-b">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-700">{hasilSemua.length}</div>
              <div className="text-xs text-blue-900 mt-1">Total Peserta</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-700">{rata}</div>
              <div className="text-xs text-green-900 mt-1">Rata-rata</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-amber-700">{gradeCount.A + gradeCount.B}</div>
              <div className="text-xs text-amber-900 mt-1">Lulus (A/B)</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-red-700">{gradeCount.D + gradeCount.E}</div>
              <div className="text-xs text-red-900 mt-1">Remedial</div>
            </div>
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
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-700">Daftar Nilai Mahasiswa</h3>
              <button onClick={hapusSemuaData} className="text-xs text-red-600 hover:underline">🗑 Hapus semua data</button>
            </div>
            {loading ? <p className="text-center py-10 text-slate-500">Memuat...</p> :
             hasilSemua.length === 0 ? <p className="text-center py-10 text-slate-500">Belum ada submission.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-2 text-left">No</th>
                      <th className="p-2 text-left">Nama</th>
                      <th className="p-2 text-left">NIM</th>
                      <th className="p-2 text-left">Kelas</th>
                      <th className="p-2 text-center">Skor</th>
                      <th className="p-2 text-center">%</th>
                      <th className="p-2 text-center">Grade</th>
                      <th className="p-2 text-left">Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasilSemua.map((h, i) => (
                      <tr key={h.id} className="border-b hover:bg-slate-50">
                        <td className="p-2">{i+1}</td>
                        <td className="p-2 font-semibold">{h.nama}</td>
                        <td className="p-2 font-mono text-xs">{h.nim}</td>
                        <td className="p-2 text-xs">{h.kelas}</td>
                        <td className="p-2 text-center font-bold">{h.total_skor}/{h.total_bobot}</td>
                        <td className="p-2 text-center">{h.persen}%</td>
                        <td className="p-2 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-white text-xs font-bold
                            ${h.grade==='A'?'bg-green-600':''}${h.grade==='B'?'bg-blue-600':''}
                            ${h.grade==='C'?'bg-amber-500':''}${h.grade==='D'?'bg-orange-600':''}
                            ${h.grade==='E'?'bg-red-600':''}`}>{h.grade}</span>
                        </td>
                        <td className="p-2 text-xs text-slate-600">{new Date(h.created_at).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
