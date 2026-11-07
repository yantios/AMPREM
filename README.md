# Jemci

Frontend (`public/`) + backend Go (`/api/*`) dalam satu server, siap deploy di Railway. Logic memakai `ytmusic.go` milik Jelan.

## Struktur
- `public/` : seluruh UI (`index.html`, `sw.js`, `manifest.json`, ikon, foto). Hanya folder ini yang tersaji ke publik.
- `main.go` : server (route /api/*, /healthz, file statis, shutdown halus)
- `internal/ytmusic/engine.go` : logic asli (Search, PlayMeta, Stream, Download, Album, Playlist)
- `internal/ytmusic/server.go` : CORS, rate limit 240/menit/IP, cache in-memory, timeout
- `internal/ytmusic/proxy.go` : proxy audio dan gambar
- `Dockerfile`, `railway.json` : konfigurasi build/deploy Railway

## Deploy ke Railway
1. Push folder ini ke GitHub (jangan commit file `.env`).
2. Railway > New Project > Deploy from GitHub repo > pilih repo ini. Railway otomatis memakai `Dockerfile`.
3. Tab Variables, tambahkan `DL_API_KEY` (key downloader kamu). Opsional: `DL_PRIMARY`, `DL_FALLBACK`, `PROXY_ALLOW`.
4. Tab Settings > Networking > Generate Domain. Selesai.
`go.sum` dibuat otomatis saat build (`go mod tidy` ada di Dockerfile), jadi tidak perlu dibuat manual. Healthcheck: `/healthz`.

## Tes lokal (Termux / PC)
```
pkg install golang
echo 'DL_API_KEY=isi_key_kamu' > .env
sh jalankan.sh
```
Buka http://localhost:8080. Port bisa diubah lewat env `PORT`.

## Yang perlu kamu ganti
- Foto developer: `public/foto-jelan.jpg`. Logo: `public/logo.png`.
- Link APK: cari `id="apk"` di `public/index.html`.

## Catatan
- Key downloader tidak hardcode. Key lama pernah terkirim di chat dan sempat ada di `.env.example`, sebaiknya diganti.
- `/api/stream` bisa lambat (polling converter). UI menampilkan "Menyiapkan audio...".
- Mengambil audio YouTube lewat converter pihak ketiga melanggar ketentuan YouTube. Pakai untuk proyek pribadi/belajar.

## v1.9 (pindah ke Railway)
- Vercel dihapus (`api/`, `vercel.json`, batas proxy 4 MB). Server tunggal `main.go` + `Dockerfile` + `railway.json`.
- Perbaikan error deploy: `go.sum` hilang dan semua file `api/*.go` berisi fungsi `Handler` yang sama sehingga `go build ./...` gagal.
- Keamanan: file statis hanya dari `public/` (sebelumnya seluruh folder, termasuk `.env` dan kode, bisa diakses lewat URL). Rate limit membuang data lama supaya memori tidak membengkak.

## v1.3
- `/api/proxy` sekarang menerima semua host publik (host lokal/privat diblokir). Batasi dengan env `PROXY_ALLOW` bila perlu.
- `/api/img` = proxy gambar cover (cadangan kalau gambar langsung gagal).
- Audio Dinamis dan Equalizer memakai Web Audio; audio otomatis lewat proxy supaya bisa diproses.

## v1.3.1 (perbaikan error saat memutar)
- Link audio dari converter bisa kedaluwarsa tapi masih tersimpan di cache (browser 20 menit, server 15 menit). Sekarang kalau audio gagal, aplikasi otomatis mengambil link baru satu kali, dan tombol play setelah error juga memakai link baru.
- Pesan error converter (API key salah, kuota habis, dll) sekarang tampil jelas, bukan "<nil>".
- (Pemotongan 4 MB khusus Vercel sudah dihapus di v1.9; di Railway audio mengalir penuh.)
- File contoh env diganti nama jadi `.env.example` dan key aslinya dihapus.

## v1.4
- Identitas baru monochrome hitam-putih: logo gerbang baru (navbar, favicon, manifest, halaman developer), tema 1 jadi hitam-putih.
- Pembuka sinematik CSS murni (~8 detik): logo reveal, gerbang muncul dari gelap, rune menyala, pintu terbuka, cahaya putih, transisi ke beranda. Hanya jalan di sesi baru, tombol "Lewati" selalu ada, dan otomatis hilang walau animasi gagal. Mendukung reduced-motion.
- Audio lebih cepat siap: polling converter 250 ms (sebelumnya 400 ms), batas waktu per request, tunggu MP3 maksimal 0,8 dtk (sebelumnya 1,5 dtk).

## v1.5 (Jemci)
- Nama baru Jemci, logo baru (`logo.png`, ikon PWA PNG), pintu gerbang dihapus, opening baru: logo muncul dengan animasi halus (bisa dimatikan di Pengaturan > Tampilkan opening).
- Audio lebih cepat siap: bawaan sekarang mode cepat (pakai hasil converter yang selesai duluan; HD MP3 320 bisa dinyalakan di Pengaturan). Server mencoba domain cadangan bersamaan bila domain utama lambat, polling 180 ms, permintaan identik digabung (tidak konversi dua kali), lagu berikutnya di-prefetch lebih awal.
- Tampilan lebih halus: transisi halaman, animasi kartu bertahap, tombol pegas, overlay lebih lembut, efek blur latar yang berat dihapus.
- Developer: foto baru, bio, teks Tentang Jemci lebih lengkap, link TikTok/Instagram/Saluran terisi.
- Perbaikan: akses sessionStorage yang bisa menjatuhkan seluruh script di mode privat, tombol Download APK kosong kini memberi tahu, `.env.example.txt` tidak lagi berisi key.

## v1.6
- Audio lebih cepat bunyi: lagu disiapkan di latar belakang sebelum diketuk (2 lagu teratas tiap baris beranda, hasil pencarian, dan 2 lagu berikutnya di antrean), maksimal 2 konversi bersamaan, dan antrean disiapkan dibatalkan saat lagu baru diputar. Server: cadangan domain converter dicoba setelah 1 detik (sebelumnya 2), polling 150 ms, tunggu MP3 0,3 dtk. Bisa dimatikan di Pengaturan > Siapkan lagu lebih awal (hemat kuota converter).
- Beranda baru: banner 8 artis (foto artis dari YouTube Music), baris lagu artis terkenal dunia, viral Korea, Indonesia, Jepang, Filipina, Artis Pilihan (foto bulat). Playlist dan album dihapus dari beranda. Daftar artis ada di `BAN` dan `REG` di `index.html`, ganti sesuka hati.
- Service worker naik ke v2 supaya tampilan baru langsung terpakai.

## v1.7
- Beranda: banner dan Global Top 20 berisi lagu trending dunia, plus baris Trending di Korea, Indonesia, Jepang, Filipina. Daftar lagu (artis + judul) ada di `WLD`, `KR`, `ID`, `JP`, `PH` di `index.html`; tiap entri dicari di YouTube Music dan hasil pertama dipakai. Bendera dan Jelajahi Genre di beranda dihapus (genre tetap ada di Mencari).
- Developer: latar foto bergerak halus (zoom pelan + cahaya bergeser), mati kalau Kurangi animasi aktif.
- Tombol Download APK menampilkan "Coming soon!!".

## v1.8
- Trending dunia (banner dan Global Top 20) hanya lagu berbahasa Inggris. Daftar lagu Latin/K-Pop pindah ke baris sendiri.
- Beranda diperbanyak: Mulai Cepat (grid), Rilis Terbaru, Hits Pop Sepanjang Masa, Artis K-Pop/Indonesia (foto bulat), K-Pop Wave, Hip-Hop dan R&B, Latin Heat, Galau Inggris, Galau Indonesia, J-Pop dan Anime, Hits OPM, Santai dan Fokus, Semangat Olahraga. Daftarnya (`CPOP`, `CKP`, dst.) ada di `index.html`.
- Latar foto developer lebih hidup: bola cahaya melayang, zoom foto lebih jelas, dan not musik naik pelan.
