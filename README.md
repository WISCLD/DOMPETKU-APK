# DOMPETKU - Android APK (Capacitor + GitHub Actions)

Proyek ini membungkus aplikasi **DOMPETKU** menjadi APK Android mandiri (100% offline tanpa bar browser).

## Struktur Folder
- `www/` -> Berisi seluruh aset aplikasi (`index.html`, `style.css`, `script.js`, `manifest.json`, `sw.js`, `icon.png`)
- `package.json` & `capacitor.config.json` -> Konfigurasi Capacitor
- `.github/workflows/build-apk.yml` -> Workflow otomatis di GitHub Actions untuk membangun `app-debug.apk`

## Cara Mengunduh APK di GitHub
1. Upload seluruh isi folder ini ke repositori GitHub kamu (branch `main`).
2. Buka tab **Actions** di repositori GitHub.
3. Klik workflow **Build DOMPETKU APK** yang berjalan otomatis setelah push (atau klik **Run workflow**).
4. Setelah selesai (centang hijau), scroll ke bagian **Artifacts** di halaman hasil build tersebut dan unduh **`dompetku-debug-apk`**.
5. Ekstrak file `.zip` tersebut lalu instal **`app-debug.apk`** di HP Android kamu.
