# 📱 APK Conversion Guide - DarkNet Chat

## Metode 1: Bubblewrap CLI (Google Official)

### Step 1: Install Bubblewrap
```bash
npm install -g @bubblewrap/cli
```

### Step 2: Initialize Project
```bash
mkdir android-build && cd android-build
bubblewrap init --manifest=https://your-domain.com/manifest.json
```

### Step 3: Configure
- Application name: **DarkNet Chat**
- Application ID: `com.yourname.darknet` (contoh: `com.antu.darknet`)
- Display mode: `standalone`
- Orientation: `default`
- Status bar color: `#0a0a0a`
- Splash screen color: `#0a0a0a`

### Step 4: Build
```bash
# Build APK (universal - works on all devices)
bubblewrap build --universalApk

# Output:
#   app-release-signed.apk    ← Install langsung
#   app-release-bundle.aab    ← Upload ke Play Store
```

---

## Metode 2: PWA Builder (Open Source)

### Step 1: Clone PWA Builder
```bash
git clone https://github.com/Dobidop/pwa-builder.git
cd pwa-builder
```

### Step 2: Create Project
```bash
node create-pwa-app.js
# Isi:
#   Project Name: darknet-chat
#   App Name: DarkNet Chat
#   Package: com.antu.darknet
```

### Step 3: Copy Web Files
```bash
# Copy semua file dari darknet_chat ke folder project baru
cp -r ../darknet_chat/* ./
```

### Step 4: Build
```bash
npm run build
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Metode 3: Online Converter (Cepat)

1. Deploy web app ke hosting (Railway, Render, VPS)
2. Buka [FreeWebToApk.com](https://freewebtoapk.com)
3. Masukkan URL web app
4. Upload icon 512x512 PNG
5. Download APK instantly

---

## 🔐 Trusted Web Activity (TWA) - Remove Address Bar

### Generate SHA-256 Fingerprint
```bash
cd android-build
keytool -list -v -keystore android.keystore -alias android
# Copy SHA-256 fingerprint dari output
```

### Update assetlinks.json
File: `public/.well-known/assetlinks.json`
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourname.darknet",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

### Rebuild APK
```bash
bubblewrap build --universalApk
```

---

## 🚀 Deploy ke Cloud (24/7 Access)

### Railway (Free)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway domain
```

### Render (Free)
1. Push ke GitHub
2. Connect Render ke repo
3. Build: `npm install`
4. Start: `npm start`
5. Deploy

### VPS dengan PM2
```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start server.js --name darknet-chat

# Auto-start on boot
pm2 startup
pm2 save

# Monitor
pm2 monit
```

---

## 📋 Checklist Sebelum Release

- [ ] Ganti JWT_SECRET di .env
- [ ] Ganti admin password (hash bcrypt baru)
- [ ] Setup HTTPS (Let's Encrypt)
- [ ] Test di Android Chrome
- [ ] Test di iOS Safari
- [ ] Test file upload/download
- [ ] Test admin panel
- [ ] Generate real PNG icons (ganti SVG placeholder)
- [ ] Setup TWA assetlinks.json
- [ ] Build APK dengan Bubblewrap
- [ ] Test APK di device

---

## 🛠️ Troubleshooting

### APK shows address bar
→ Pastikan assetlinks.json valid dan domain accessible

### Socket.IO not working in APK
→ Pastikan server support HTTPS dan CORS enabled

### File upload fails
→ Cek folder `public/uploads/` writable

### Admin panel 403
→ Pastikan admin token valid, coba login ulang

---

**Built by Antu.py | Project: ShadowKeep**
