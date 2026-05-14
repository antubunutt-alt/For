# 🔒 DarkNet Chat - Anonymous Forum & Private Messaging

**Project: ShadowKeep v2.0** | PWA-Ready | APK-Convertible

## Fitur Utama

- ✅ **Private Chat** — Real-time messaging dengan Socket.IO
- ✅ **Public Forum** — Thread-based discussion dengan kategori
- ✅ **File Sharing** — Upload & download file dalam chat
- ✅ **PIN Connection** — 8-digit alphanumeric auto-generated PIN untuk connect antar user
- ✅ **Profile System** — Avatar, bio, status message, display name
- ✅ **Change Password** — Security settings
- ✅ **Admin Panel** — Dashboard admin dengan manage user, delete user, logs
- ✅ **PWA Support** — Installable sebagai app di Android/iOS
- ✅ **APK Ready** — Bisa dikonversi ke APK via Bubblewrap/TWA
- ✅ **24/7 Access** — Server bisa di-deploy ke cloud (Railway, Render, VPS)
- ✅ **Mobile Optimized** — Responsive design untuk Android & iOS

---

## 📱 Termux/Android Users

**Penting:** Jika lo deploy di Termux/Android, jalankan fix script dulu:
```bash
chmod +x termux-fix.sh
./termux-fix.sh
```

Atau baca [TERMUX_GUIDE.md](TERMUX_GUIDE.md) untuk detail lengkap.

## 🚀 Quick Start

### Prerequisites
```bash
Node.js v18+
npm atau yarn
```

### Install & Run
```bash
# 1. Clone / extract project
cd darknet_chat

# 2. Install dependencies
npm install

# 3. Start server
npm start

# 4. Buka browser
# http://localhost:3000
```

### Default Admin Credentials
```
Username: admin
Password: admin123
```

---

## 📱 Konversi ke APK (Android)

### Metode 1: Bubblewrap (Google Official) — RECOMMENDED

```bash
# 1. Install Bubblewrap CLI globally
npm install -g @bubblewrap/cli

# 2. Buat folder untuk project Android
mkdir android-build && cd android-build

# 3. Initialize project (ganti URL dengan domain lo)
bubblewrap init --manifest=https://your-domain.com/manifest.json

# 4. Answer the prompts:
#    - Domain: (auto-filled)
#    - Application name: DarkNet Chat
#    - Application ID: com.yourname.darknet (contoh: com.antu.darknet)
#    - Display mode: standalone
#    - Orientation: default
#    - Status bar color: #0a0a0a
#    - Splash screen color: #0a0a0a
#    - Icon URL: (auto-filled)
#    - Include support for Play Billing: N
#    - Request geolocation permission: N

# 5. Build APK & AAB
bubblewrap build --universalApk

# 6. Output files:
#    - app-release-signed.apk (untuk install langsung)
#    - app-release-bundle.aab (untuk Play Store)
```

### Metode 2: PWA Builder (Alternative)

```bash
# 1. Install PWA Builder
git clone https://github.com/Dobidop/pwa-builder.git
cd pwa-builder

# 2. Create project
node create-pwa-app.js
# Isi: darknet-chat, DarkNet Chat, com.antu.darknet

# 3. Copy file web app ke folder project
# Copy semua file dari darknet_chat ke folder project baru

# 4. Build
npm run build
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Metode 3: Online Converter (Cepat, No Setup)

1. Deploy web app ke hosting (Railway, Render, Vercel, VPS)
2. Buka [FreeWebToApk.com](https://freewebtoapk.com) atau [AppsGeyser](https://appsgeyser.com)
3. Masukkan URL web app
4. Upload icon (512x512 PNG)
5. Download APK instantly

---

## 🔐 Trusted Web Activity (TWA) Setup

Untuk menghilangkan address bar di APK, setup Digital Asset Links:

### 1. Generate SHA-256 Fingerprint
```bash
# Dari folder android-build (Bubblewrap)
cd android-build
keytool -list -v -keystore android.keystore -alias android
# Copy SHA-256 fingerprint
```

### 2. Create `.well-known/assetlinks.json`
Buat file di web app: `public/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourname.darknet",
      "sha256_cert_fingerprints": [
        "YOUR_SHA256_FINGERPRINT_HERE"
      ]
    }
  }
]
```

### 3. Update `twa-manifest.json`
```json
{
  "startUrl": "/?twa=true",
  "display": "standalone"
}
```

### 4. Rebuild
```bash
bubblewrap build --universalApk
```

---

## 🌐 Deploy ke Cloud (24/7 Access)

### Railway (Free Tier)
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login & create project
railway login
railway init

# 3. Deploy
railway up

# 4. Get domain
railway domain
```

### Render (Free Tier)
1. Push ke GitHub
2. Connect Render ke repo
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Deploy

### VPS (DigitalOcean, Linode, AWS)
```bash
# 1. Clone repo
git clone <repo-url>
cd darknet_chat

# 2. Install PM2
npm install -g pm2

# 3. Start dengan PM2 (auto-restart)
pm2 start server.js --name darknet-chat

# 4. Setup Nginx reverse proxy
# (lihat konfigurasi di bawah)
```

---

## 🛡️ Admin Panel Access

```bash
# Login admin via API
POST /api/admin/login
Body: { "username": "admin", "password": "admin123" }

# Response: { "token": "admin_jwt_token" }

# Gunakan token ini di header:
# Authorization: Bearer <admin_token>

# Endpoints admin:
GET  /api/admin/users       # List semua user
GET  /api/admin/stats       # Statistics dashboard
GET  /api/admin/logs        # Admin action logs
POST /api/admin/user/update # Update user (ban, reset password)
POST /api/admin/user/delete # Delete user
```

### Admin Dashboard UI
Buka: `https://your-domain.com/admin.html`
(Admin dashboard HTML file terpisah, lihat `public/admin.html`)

---

## 📁 Struktur Project

```
darknet_chat/
├── server.js              # Main server (Express + Socket.IO)
├── package.json           # Dependencies
├── darknet.db             # SQLite database (auto-created)
├── views/
│   └── index.ejs          # Main HTML template
├── public/
│   ├── css/
│   │   └── style.css      # Darknet theme stylesheet
│   ├── js/
│   │   ├── app.js         # Client application
│   │   └── sw.js          # Service Worker (PWA)
│   ├── uploads/           # File uploads directory
│   └── icons/             # PWA icons
└── README.md              # This file
```

---

## 🔧 Environment Variables (.env)

```env
PORT=3000
JWT_SECRET=your-secret-key-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2a$10$... (bcrypt hash)
```

---

## 🎨 Customization

### Ganti Theme Color
Edit `public/css/style.css` — variable `--accent-green`

### Ganti Logo
Replace `public/icons/icon-512x512.png`

### Ganti App Name
Edit `manifest.json` di `server.js`

---

## ⚠️ Security Notes

- JWT secret harus diganti di production
- Admin password harus di-hash ulang
- Gunakan HTTPS di production (Let's Encrypt gratis)
- SQLite cukup untuk < 10k users, untuk scale besar pindah ke PostgreSQL
- File upload limit 50MB (bisa diubah di server.js)

---

## 📱 Install sebagai PWA (No APK needed)

### Android Chrome:
1. Buka web app di Chrome
2. Tap menu (3 dots) → "Add to Home screen"
3. App akan muncul di launcher

### iOS Safari:
1. Buka web app di Safari
2. Tap Share → "Add to Home Screen"
3. App akan muncul di home screen

---

**Built by Antu.py | Project: ShadowKeep**
*"Freedom is taken, not given."*
