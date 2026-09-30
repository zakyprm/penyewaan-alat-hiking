# Requirements: Web Aplikasi Penyewaan Alat Hiking

## Pendahuluan

Web aplikasi untuk satu toko rental alat hiking. Pelanggan bisa melihat katalog, mengecek ketersediaan per tanggal, dan menyewa secara online. Admin mengelola alat, pesanan, sewa langsung di toko (walk-in), pengembalian, denda, dan jaminan.

Proyek ini dimulai sebagai portofolio, tetapi dirancang API-first supaya nanti bisa dipakai oleh mobile app (Expo) dan dikembangkan ke produksi.

## Glosarium

- **Alat**: barang yang disewakan (tenda, carrier, sleeping bag, dll).
- **Alat Publik**: alat yang tampil di katalog pelanggan.
- **Alat Internal**: alat yang tidak tampil di katalog, hanya bisa disewa lewat admin.
- **Pesanan**: satu transaksi sewa berisi satu atau lebih alat untuk satu rentang waktu.
- **Jatuh tempo**: tanggal dan jam alat harus dikembalikan.
- **Grace period**: toleransi setelah jatuh tempo tanpa denda (default 12 jam).
- **Jaminan**: Deposit Uang atau KTP fisik, dipilih pelanggan.
- **Walk-in**: pelanggan datang langsung ke toko, pesanan dibuat oleh admin.

---

## Requirement 1: Autentikasi dan Peran Pengguna

**User story:** Sebagai pengguna, saya ingin mendaftar dan masuk ke akun, supaya bisa menyewa dan melihat riwayat sewa saya.

### Acceptance Criteria

1. Pengguna dapat mendaftar dengan nama, email, nomor HP, dan password, atau masuk dengan akun Google.
2. Sistem mengenal dua peran: `CUSTOMER` dan `ADMIN`. Pendaftaran publik selalu menghasilkan peran `CUSTOMER`.
3. WHEN pengguna yang belum login mencoba checkout THEN sistem mengarahkan ke halaman login lalu kembali ke checkout setelah berhasil.
4. WHEN pengguna non-admin mengakses halaman atau API admin THEN sistem menolak dengan status 403.
5. Sesi autentikasi dapat dipakai oleh web dan (nanti) mobile app.

## Requirement 2: Katalog dan Pencarian Alat

**User story:** Sebagai pelanggan, saya ingin mencari dan memfilter alat, supaya cepat menemukan yang saya butuhkan.

### Acceptance Criteria

1. Katalog hanya menampilkan alat berstatus Publik dan aktif.
2. Pelanggan dapat mencari alat berdasarkan nama.
3. Pelanggan dapat memfilter berdasarkan kategori dan rentang harga sewa per hari.
4. WHEN pelanggan mengisi rentang tanggal sewa di filter THEN katalog hanya menampilkan alat yang tersedia minimal 1 unit pada rentang tersebut.
5. Kartu alat menampilkan foto, nama, kategori, dan harga sewa per hari.
6. Katalog dapat diakses tanpa login.

## Requirement 3: Detail Alat dan Cek Ketersediaan

**User story:** Sebagai pelanggan, saya ingin melihat detail alat dan mengecek ketersediaannya di tanggal tertentu, supaya yakin sebelum menyewa.

### Acceptance Criteria

1. Halaman detail menampilkan foto, deskripsi, spesifikasi, harga sewa per hari, nilai deposit, dan jenis jaminan yang diizinkan.
2. Pelanggan dapat memilih waktu ambil dan waktu kembali.
3. WHEN pelanggan memilih rentang waktu THEN sistem menampilkan jumlah unit yang tersedia pada rentang itu.
4. Jumlah unit yang bisa ditambahkan ke keranjang tidak boleh melebihi unit tersedia.
5. Alat Internal tidak dapat diakses lewat halaman detail publik (respons 404).

## Requirement 4: Keranjang Sewa

**User story:** Sebagai pelanggan, saya ingin mengumpulkan beberapa alat dalam satu keranjang, supaya bisa menyewa sekaligus.

### Acceptance Criteria

1. Satu keranjang memakai satu rentang waktu sewa untuk semua alat.
2. WHEN pelanggan mengubah rentang waktu di keranjang THEN sistem mengecek ulang ketersediaan semua alat dan menandai alat yang tidak lagi cukup.
3. Keranjang menampilkan rincian: harga per hari × jumlah hari × jumlah unit per alat, subtotal sewa, dan total deposit.
4. Keranjang tersimpan di perangkat (local storage) dan tidak mengunci stok.

## Requirement 5: Aturan Ketersediaan per Tanggal

**User story:** Sebagai pemilik toko, saya ingin sistem mencegah alat disewa dua kali di waktu yang sama.

### Acceptance Criteria

1. Unit tersedia = stok total alat − jumlah unit pada pesanan lain yang rentang waktunya beririsan dan statusnya menahan stok.
2. Status yang menahan stok: `MENUNGGU_PEMBAYARAN` (yang belum kedaluwarsa), `DIKONFIRMASI`, dan `DIAMBIL`.
3. Pesanan `DIAMBIL` yang sudah melewati jatuh tempo tetap menahan stok sampai benar-benar dikembalikan.
4. WHEN dua pesanan untuk unit terakhir dibuat bersamaan THEN hanya satu yang berhasil, yang lain ditolak dengan pesan stok tidak cukup.
5. Ketersediaan dicek ulang di server saat pesanan dibuat, bukan hanya di sisi klien.

## Requirement 6: Perhitungan Biaya Sewa

**User story:** Sebagai pelanggan, saya ingin biaya dihitung transparan, supaya tahu persis apa yang saya bayar.

### Acceptance Criteria

1. Jumlah hari sewa = selisih waktu kembali dan waktu ambil dalam jam, dibagi 24, dibulatkan ke atas. Minimal 1 hari.
2. Biaya sewa per alat = harga per hari × jumlah hari × jumlah unit.
3. Total deposit = jumlah (deposit per unit × jumlah unit) untuk semua alat, hanya jika jaminan yang dipilih adalah Deposit Uang.
4. Total bayar di awal = subtotal sewa + total deposit (jika ada).
5. Harga dan nilai deposit disalin (snapshot) ke pesanan saat dibuat, sehingga perubahan harga alat tidak mempengaruhi pesanan lama.
6. Semua nominal disimpan dalam Rupiah bilangan bulat.

## Requirement 7: Pilihan Jaminan (Deposit Uang atau KTP)

**User story:** Sebagai pelanggan, saya ingin memilih jenis jaminan, supaya sesuai dengan kondisi saya.

### Acceptance Criteria

1. Saat checkout, pelanggan memilih jaminan: `DEPOSIT` atau `KTP`.
2. Hanya jenis jaminan yang diaktifkan admin di pengaturan yang ditampilkan.
3. Setiap alat memiliki pengaturan "izinkan jaminan KTP". IF ada satu alat di keranjang yang tidak mengizinkan KTP THEN opsi KTP tidak tersedia untuk pesanan tersebut, dengan penjelasan alat mana yang menyebabkannya.
4. Jaminan Deposit dibayar bersama biaya sewa.
5. Jaminan KTP diserahkan fisik saat pengambilan alat di toko.
6. Sistem TIDAK menyimpan foto maupun nomor KTP. Sistem hanya mencatat status jaminan (`BELUM_DITERIMA`, `DITERIMA`, `DIKEMBALIKAN`), admin yang mencatat, dan waktunya.
7. WHEN jaminan pesanan adalah KTP dan statusnya belum `DITERIMA` THEN admin tidak dapat mengubah pesanan menjadi `DIAMBIL`.

## Requirement 8: Checkout dan Pembayaran

**User story:** Sebagai pelanggan, saya ingin membayar online atau di toko, supaya fleksibel.

### Acceptance Criteria

1. Pelanggan memilih metode bayar: `ONLINE` (Midtrans) atau `BAYAR_DI_TOKO`.
2. WHEN metode `ONLINE` dipilih THEN sistem membuat transaksi Midtrans dan menampilkan halaman pembayaran (Snap), pesanan berstatus `MENUNGGU_PEMBAYARAN`.
3. WHEN notifikasi Midtrans menyatakan pembayaran sukses THEN pesanan berubah menjadi `DIKONFIRMASI` dan pembayaran `LUNAS`.
4. Notifikasi Midtrans diverifikasi dengan signature key. Notifikasi yang tidak valid diabaikan.
5. IF pembayaran online tidak diselesaikan dalam batas waktu (default 60 menit) THEN pesanan otomatis `DIBATALKAN` dan stok dilepas.
6. WHEN metode `BAYAR_DI_TOKO` dipilih THEN pesanan langsung `DIKONFIRMASI` dengan status pembayaran `MENUNGGU`, dibayar saat pengambilan.
7. IF pesanan `BAYAR_DI_TOKO` belum dibayar sampai batas waktu (default 24 jam sebelum waktu ambil, atau saat waktu ambil jika pesanan dibuat kurang dari 24 jam sebelumnya) THEN pesanan otomatis `DIBATALKAN`. Batas waktu ditampilkan jelas ke pelanggan.
8. Admin dapat menandai pembayaran di toko sebagai `LUNAS` dengan memilih cara bayar (tunai, transfer, QRIS).

## Requirement 9: Riwayat dan Status Pesanan Pelanggan

**User story:** Sebagai pelanggan, saya ingin melihat status pesanan saya, supaya tahu apa langkah berikutnya.

### Acceptance Criteria

1. Pelanggan melihat daftar pesanannya beserta status, rentang waktu, dan total.
2. Detail pesanan menampilkan rincian biaya, jenis jaminan, status jaminan, status pembayaran, jatuh tempo, batas akhir grace period, dan denda (jika ada).
3. Pelanggan dapat membatalkan pesanan berstatus `MENUNGGU_PEMBAYARAN` atau `DIKONFIRMASI` yang belum dibayar.
4. Alur status pesanan: `MENUNGGU_PEMBAYARAN` → `DIKONFIRMASI` → `DIAMBIL` → `DIKEMBALIKAN` → `SELESAI`, atau `DIBATALKAN`.

## Requirement 10: Grace Period dan Denda Keterlambatan

**User story:** Sebagai pemilik toko, saya ingin memberi toleransi keterlambatan yang adil, dan menghitung denda secara otomatis setelah toleransi habis.

### Acceptance Criteria

1. Grace period default 12 jam dari jatuh tempo, dapat diubah admin di pengaturan.
2. IF alat dikembalikan ≤ jatuh tempo + grace period THEN denda keterlambatan = 0.
3. IF alat dikembalikan > jatuh tempo + grace period THEN jam telat dihitung dari jatuh tempo asli, lalu hari telat = jam telat ÷ 24 dibulatkan ke atas.
4. Denda keterlambatan = jumlah (harga per hari × jumlah unit) semua alat × hari telat × persentase denda ÷ 100. Persentase default 100%, dapat diubah admin.
5. Nilai grace period dan persentase denda disalin ke pesanan saat dibuat, sehingga perubahan pengaturan tidak mempengaruhi pesanan berjalan.
6. Contoh yang harus terpenuhi (jatuh tempo Minggu 10:00, 1 tenda Rp50.000/hari): kembali Minggu 20:00 → Rp0; kembali Senin 09:00 (telat 23 jam) → Rp50.000; kembali Senin 12:00 (telat 26 jam) → Rp100.000.

## Requirement 11: Pengembalian Alat, Denda Kerusakan, dan Penyelesaian Jaminan

**User story:** Sebagai admin, saya ingin mencatat pengembalian alat dan menyelesaikan jaminan dengan benar.

### Acceptance Criteria

1. Admin mencatat waktu pengembalian (default: saat ini) dan sistem menghitung denda keterlambatan otomatis.
2. Admin dapat menambahkan denda kerusakan/kehilangan dengan nominal dan catatan per alat.
3. Total denda = denda keterlambatan + denda kerusakan.
4. Untuk jaminan Deposit:
   - Sisa deposit dikembalikan = deposit − total denda (minimal 0).
   - IF total denda > deposit THEN kekurangan ditagih ke pelanggan dan harus dicatat lunas sebelum pesanan `SELESAI`.
   - Admin mencatat pengembalian sisa deposit (tunai atau transfer). Refund otomatis lewat Midtrans tidak termasuk fase ini.
5. Untuk jaminan KTP:
   - Total denda dibayar langsung saat pengembalian.
   - Admin menandai KTP `DIKEMBALIKAN` setelah denda lunas.
6. Pesanan berubah menjadi `SELESAI` hanya jika semua denda lunas dan jaminan sudah diselesaikan.

## Requirement 12: Kelola Alat (Admin)

**User story:** Sebagai admin, saya ingin mengelola data alat, supaya katalog dan stok selalu akurat.

### Acceptance Criteria

1. Admin dapat menambah, mengubah, dan menonaktifkan alat. Alat yang sudah pernah disewa tidak dihapus permanen (soft delete).
2. Data alat: nama, slug, kategori, deskripsi, spesifikasi, foto (bisa lebih dari satu), harga per hari, deposit per unit, stok total, visibilitas (`PUBLIC`/`INTERNAL`), izinkan jaminan KTP, status aktif.
3. IF stok total diubah lebih kecil dari unit yang sedang dipesan pada suatu rentang waktu mendatang THEN sistem menampilkan peringatan berisi pesanan yang terdampak.
4. Admin dapat mengubah visibilitas alat Internal menjadi Publik dan sebaliknya.
5. Admin dapat mengelola kategori (tambah, ubah, hapus jika tidak dipakai).

## Requirement 13: Sewa Walk-in dan Alat Custom (Admin)

**User story:** Sebagai admin, saya ingin membuat pesanan untuk pelanggan yang datang ke toko, termasuk untuk alat yang belum ada di katalog.

### Acceptance Criteria

1. Admin membuat pesanan lewat menu "Buat Sewa Manual".
2. Admin memilih pelanggan terdaftar atau mengisi nama dan nomor HP pelanggan tamu (tanpa akun).
3. Admin dapat memilih semua alat aktif, baik Publik maupun Internal.
4. Admin dapat menambah alat baru secara cepat (nama, kategori, harga per hari, deposit, stok) dari form pesanan. Alat ini otomatis berstatus `INTERNAL`.
5. Pesanan walk-in memakai aturan ketersediaan, biaya, jaminan, dan denda yang sama dengan pesanan online.
6. Pesanan walk-in ditandai dengan sumber `WALK_IN`.
7. Admin dapat langsung menandai pembayaran lunas, jaminan diterima, dan pesanan `DIAMBIL` dalam satu alur jika alat dibawa saat itu juga.

## Requirement 14: Kelola Pesanan (Admin)

**User story:** Sebagai admin, saya ingin memantau dan memproses semua pesanan.

### Acceptance Criteria

1. Admin melihat daftar pesanan dengan filter status, sumber (online/walk-in), metode bayar, dan rentang tanggal.
2. Admin dapat mencari pesanan berdasarkan kode pesanan, nama, atau nomor HP pelanggan.
3. Admin dapat memproses transisi status sesuai alur yang valid. Transisi yang tidak valid ditolak.
4. Setiap perubahan status, pembayaran, dan jaminan dicatat di riwayat pesanan (siapa, kapan, apa).
5. Daftar pesanan menandai pesanan yang terlambat dan yang masih dalam grace period.

## Requirement 15: Kelola Pelanggan (Admin)

**User story:** Sebagai admin, saya ingin melihat data pelanggan dan riwayat sewanya.

### Acceptance Criteria

1. Admin melihat daftar pelanggan (terdaftar) dengan pencarian nama, email, atau nomor HP.
2. Admin melihat riwayat pesanan dan total denda tiap pelanggan.

## Requirement 16: Dashboard Admin

**User story:** Sebagai admin, saya ingin ringkasan kondisi toko.

### Acceptance Criteria

1. Dashboard menampilkan: pendapatan sewa dan denda dalam periode terpilih, jumlah pesanan per status, alat yang sedang disewa, pesanan yang harus diambil dan dikembalikan hari ini, dan pesanan terlambat.
2. Dashboard menampilkan 5 alat paling sering disewa dalam periode terpilih.
3. Deposit tidak dihitung sebagai pendapatan.

## Requirement 17: Pengaturan Toko (Admin)

**User story:** Sebagai admin, saya ingin mengubah kebijakan toko tanpa mengubah kode.

### Acceptance Criteria

1. Admin dapat mengubah: grace period (jam), persentase denda keterlambatan, jaminan Deposit aktif/nonaktif, jaminan KTP aktif/nonaktif, batas waktu pembayaran online (menit), batas waktu pembatalan bayar di toko (jam sebelum waktu ambil), dan jam operasional toko.
2. Minimal satu jenis jaminan harus aktif.
3. Waktu ambil dan waktu kembali yang dipilih pelanggan harus berada dalam jam operasional toko.

## Requirement 18: UI/UX dan Non-Fungsional

**User story:** Sebagai pengguna, saya ingin aplikasi yang cepat, rapi, dan mudah dipakai di desktop maupun HP.

### Acceptance Criteria

1. Tampilan responsif (mobile-first) untuk desktop dan mobile browser.
2. Gaya visual: palet earthy/outdoor (hijau hutan, coklat, netral), font sans-serif modern, sudut membulat, komponen shadcn/ui yang konsisten.
3. Alur sewa pelanggan dari katalog sampai pesanan dibuat maksimal 4 langkah: pilih alat → pilih waktu → keranjang → checkout.
4. Komponen interaktif dapat dipakai dengan keyboard, punya label yang jelas, dan kontras warna memadai.
5. Semua logika bisnis tersedia melalui REST API (`/api/v1/...`) yang bisa dipakai mobile app.
6. Semua input divalidasi di server dengan skema Zod.
7. Zona waktu bisnis adalah Asia/Jakarta (WIB). Waktu disimpan dalam UTC di database.
8. Bahasa antarmuka: Bahasa Indonesia, format mata uang Rupiah.
