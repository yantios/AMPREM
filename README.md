# MujotDownloader

Website downloader aesthetic untuk TikTok, Instagram, X/Twitter, SnackVideo, CapCut, Dailymotion, dan Vimeo. Kredit: **Made : Jelan**.

## Menjalankan website + API

API yang disertakan dalam ZIP upload kamu (`allinone.mjs` dan `twitter.mjs`) sudah dipasang ke backend Node.js. Browser tidak bisa menjalankan modul Node `crypto` secara langsung, jadi jangan membuka `index.html` dengan klik dua kali.

1. Pasang **Node.js 18 atau lebih baru**.
2. Ekstrak ZIP ke sebuah folder.
3. Buka Terminal/Command Prompt di folder tersebut.
4. Jalankan:
   ```bash
   npm start
   ```
5. Buka `http://localhost:3000` di browser.

Tombol **Mulai proses** akan mengirim link ke backend `/api/download`, lalu menampilkan tautan media yang dikembalikan API.

## Catatan API

API pada arsip menggunakan beberapa endpoint pihak ketiga/tidak resmi dan scraping halaman platform. Endpoint dapat berubah, dibatasi, atau tidak merespons; karena itu tidak ada jaminan semua link selalu berhasil. Untuk link privat, konten yang dilindungi, atau konten yang tidak kamu punya izin untuk simpan, proses bisa gagal. Beberapa hasil (terutama stream HLS) akan terbuka di tab baru dan mungkin tidak bisa disimpan langsung sebagai file.

Gunakan hanya untuk konten yang kamu miliki atau punya izin untuk mengunduh. Jangan menambahkan cookie atau kredensial akun pribadi ke frontend.
