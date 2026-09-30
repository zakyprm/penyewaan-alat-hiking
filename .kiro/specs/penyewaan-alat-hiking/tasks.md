# Implementation Plan: Web Aplikasi Penyewaan Alat Hiking

Urutan tugas dibuat bertahap: fondasi → logika domain → admin (supaya ada data) → katalog pelanggan → checkout & pembayaran → pengembalian → dashboard → polish. Setiap tugas bisa dijalankan dan dicek sebelum lanjut.

- [x] 1. Setup proyek dan fondasi
  - Inisialisasi Next.js (App Router, TypeScript, ESLint, Tailwind, `src/`), pasang shadcn/ui dan font Inter
  - Atur tema warna earthy di CSS variables sesuai design 8.3
  - Pasang Prisma, Zod, react-hook-form, TanStack Query, Zustand, date-fns + @date-fns/tz, Vitest
  - Buat `.env.example` berisi semua variabel di design bagian 9
  - Buat struktur folder sesuai design bagian 3 dan helper `format.ts` (Rupiah, tanggal WIB)
  - _Requirements: 18.1, 18.2, 18.7, 18.8_

- [x] 2. Skema database dan seed
  - [x] 2.1 Tulis `schema.prisma` sesuai design 4.2, jalankan migrasi pertama ke Postgres (Neon atau lokal)
    - _Requirements: 6.5, 6.6, 7.6, 10.5_
  - [x] 2.2 Buat `prisma/seed.ts`: satu akun admin, kategori (Tenda, Carrier, Sleeping Bag, Alat Masak, Penerangan, Lainnya), ±12 alat publik dan 2 alat internal, baris `Setting` default
    - _Requirements: 12.2, 17.1_

- [x] 3. Logika domain murni + unit test
  - [x] 3.1 `pricing.ts`: `rentalDays`, `quote` beserta test
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 3.2 `fine.ts`: `lateFine` beserta test semua kasus di design 5.2 (termasuk batas tepat 12 jam)
    - _Requirements: 10.2, 10.3, 10.4, 10.6_
  - [x] 3.3 `settlement.ts`: `settle` untuk deposit (refund penuh, sebagian, kekurangan) dan KTP beserta test
    - _Requirements: 11.4, 11.5_
  - [x] 3.4 `order-status.ts`: `assertTransition` dengan guard di design 5.6 beserta test
    - _Requirements: 7.7, 9.4, 11.6, 14.3_
  - [x] 3.5 `schedule.ts`: validasi jam operasional, minimal waktu ambil, perhitungan `paymentDueAt` beserta test
    - _Requirements: 8.5, 8.7, 17.3_
  - [x] 3.6 Skema Zod di `src/lib/validation` untuk alat, kategori, checkout, walk-in, pengembalian, pengaturan
    - _Requirements: 18.6_

- [x] 4. Autentikasi dan otorisasi
  - Konfigurasi Better Auth dengan Prisma adapter, email/password, Google, field `role` dan `phone`
  - Route `/api/auth/[...all]`, halaman `/masuk` dan `/daftar`
  - Helper `requireUser` / `requireAdmin` untuk API dan `proxy.ts` (pengganti middleware di Next.js 16) untuk proteksi `/admin/*` dan halaman pelanggan
  - Redirect kembali ke checkout setelah login
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 5. Kerangka API dan service layer
  - Helper respons `{ data }` / `{ error }`, pemetaan `DomainError` dan `ZodError` ke kode HTTP
  - Service `settings` (baca/ubah, validasi minimal satu jaminan aktif) + endpoint `/admin/settings` dan `/settings/public`
  - _Requirements: 17.1, 17.2, 18.5_

- [x] 6. Admin: kelola kategori dan alat
  - [x] 6.1 Layout admin (sidebar desktop, drawer mobile)
    - _Requirements: 18.1_
  - [x] 6.2 Service + API kategori, halaman tabel dan dialog kategori
    - _Requirements: 12.5_
  - [x] 6.3 Service + API alat (CRUD, soft delete, visibilitas, `allowKtp`), upload foto (lokal `storage/uploads` saat development, Vercel Blob saat deploy di Task 16) dengan batasan tipe dan ukuran
    - _Requirements: 12.1, 12.2, 12.4_
  - [x] 6.4 Halaman daftar alat (filter visibilitas) dan form alat
    - _Requirements: 12.1, 12.2, 12.4_
  - [x] 6.5 Peringatan saat stok diturunkan di bawah unit yang sudah dipesan ke depan
    - _Requirements: 12.3_

- [x] 7. Ketersediaan dan pembuatan pesanan (inti)
  - [x] 7.1 Service `availability` dengan query design 5.4 (termasuk `DIAMBIL` yang telat dan `MENUNGGU_PEMBAYARAN` yang belum kedaluwarsa)
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 7.2 Service `createOrder` dalam transaksi dengan `FOR UPDATE`, snapshot harga dan kebijakan, generator kode pesanan, `Guarantee` dan `OrderEvent`
    - _Requirements: 5.4, 5.5, 6.5, 7.3, 10.5_
  - [x] 7.3 Test integrasi: rentang beririsan/tidak, alat telat kembali, dua pesanan paralel untuk unit terakhir
    - _Requirements: 5.1, 5.3, 5.4_

- [x] 8. Katalog pelanggan
  - [x] 8.1 API `/categories`, `/items`, `/items/:slug`, `/items/:slug/availability` (404 untuk alat internal)
    - _Requirements: 2.1, 2.6, 3.5_
  - [x] 8.2 Beranda: hero, kategori populer, alat unggulan, cara sewa, info jaminan dan grace period
    - _Requirements: 18.2, 18.3_
  - [x] 8.3 Katalog: pencarian, filter kategori/harga/tanggal (sidebar desktop, bottom sheet mobile), grid kartu, paginasi, skeleton loading
    - _Requirements: 2.2, 2.3, 2.4, 2.5_
  - [x] 8.4 Detail alat: galeri, spesifikasi, pemilih tanggal+jam sesuai jam operasional, unit tersedia, tombol tambah ke keranjang
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 17.3_

- [x] 9. Keranjang
  - Store Zustand + persist, satu rentang waktu untuk semua alat
  - API `/quote` untuk rincian biaya dan jaminan yang diizinkan
  - Halaman keranjang: ubah waktu, cek ulang ketersediaan, tandai alat yang tidak cukup
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.3_

- [x] 10. Checkout dan pembayaran
  - [x] 10.1 Halaman checkout satu langkah: kontak, pilihan jaminan (sembunyikan yang nonaktif, jelaskan alasan jika KTP tidak diizinkan), metode bayar, ringkasan
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 18.3_
  - [x] 10.2 `POST /orders` untuk `BAYAR_DI_TOKO` (langsung `DIKONFIRMASI`, tampilkan batas bayar)
    - _Requirements: 8.6, 8.7_
  - [x] 10.3 Integrasi Midtrans Snap: buat transaksi, tampilkan popup, endpoint `/orders/:code/pay`
    - _Requirements: 8.2_
  - [x] 10.4 Webhook Midtrans: verifikasi signature, cek status ulang, idempotensi, penanganan pembayaran yang datang setelah kedaluwarsa, beserta test
    - _Requirements: 8.3, 8.4_
  - [x] 10.5 Endpoint cron `expire-orders` dengan `CRON_SECRET`, konfigurasi `vercel.json`, beserta test
    - _Requirements: 8.5, 8.7_

- [x] 11. Pesanan pelanggan
  - Halaman daftar pesanan dan detail (timeline status, rincian biaya, jatuh tempo, batas grace, status jaminan, instruksi langkah berikutnya)
  - Pembatalan oleh pelanggan sesuai aturan
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 12. Admin: kelola pesanan
  - [x] 12.1 Halaman daftar pesanan: filter, pencarian, badge terlambat/dalam grace
    - _Requirements: 14.1, 14.2, 14.5_
  - [x] 12.2 Detail pesanan: tombol aksi sesuai status, panel pembayaran (catat bayar di toko: tunai/transfer/QRIS), panel jaminan (terima KTP/deposit), riwayat event
    - _Requirements: 7.7, 8.8, 14.3, 14.4_
  - [x] 12.3 Aksi serah alat (`pickup`) dengan guard pembayaran dan jaminan
    - _Requirements: 7.7, 14.3_
  - [x] 12.4 Pembatalan oleh admin dengan alasan
    - _Requirements: 14.3, 14.4_

- [x] 13. Admin: sewa walk-in
  - Halaman "Buat Sewa Manual": pilih pelanggan terdaftar atau tamu, pilih alat publik + internal
  - Dialog "Tambah alat cepat" yang otomatis `INTERNAL`
  - Opsi "Diambil sekarang" (bayar lunas + jaminan diterima + `DIAMBIL` dalam satu transaksi)
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

- [x] 14. Pengembalian, denda, dan penyelesaian jaminan
  - [x] 14.1 Dialog catat pengembalian: `returnedAt`, pratinjau denda telat, denda kerusakan/kehilangan per alat
    - _Requirements: 11.1, 11.2, 11.3_
  - [x] 14.2 Layar penyelesaian: hasil `settle()`, catat refund deposit / tagih kekurangan / bayar denda KTP, tandai KTP dikembalikan
    - _Requirements: 11.4, 11.5_
  - [x] 14.3 Aksi `complete` dengan guard, test integrasi alur deposit dan KTP
    - _Requirements: 11.6_

- [x] 15. Admin: pelanggan dan dashboard
  - [x] 15.1 Daftar pelanggan dengan pencarian, detail riwayat pesanan dan total denda
    - _Requirements: 15.1, 15.2_
  - [x] 15.2 Dashboard: pendapatan sewa + denda (tanpa deposit), jumlah per status, ambil/kembali hari ini, terlambat, 5 alat terpopuler, filter periode
    - _Requirements: 16.1, 16.2, 16.3_
  - [x] 15.3 Halaman pengaturan toko
    - _Requirements: 17.1, 17.2_

- [ ] 16. Polish, aksesibilitas, dan deploy
  - Cek responsif di ukuran mobile, tablet, desktop
  - Cek aksesibilitas dasar: label, fokus keyboard, kontras, status tidak hanya warna
  - Empty state, error state, toast untuk semua aksi
  - Deploy ke Vercel + Neon, set environment variables, uji end-to-end dengan Midtrans sandbox
  - README: cara setup lokal, akun demo, arsitektur singkat, screenshot (untuk portofolio)
  - _Requirements: 18.1, 18.2, 18.4_
