# 📱 Termux/Android Deployment Guide

## Masalah Umum

Saat `npm install` di Termux, sering muncul error:
```
gyp: Undefined variable android_ndk_path in binding.gyp
```

Ini karena `node-gyp` butuh konfigurasi khusus untuk Android.

---

## 🚀 Solusi Cepat (Satu Command)

```bash
chmod +x termux-fix.sh
./termux-fix.sh
```

Script ini akan:
1. Fix `android_ndk_path` error
2. Install build dependencies
3. Install semua npm packages
4. Auto-detect SQLite driver (better-sqlite3 → sqlite3 → JSON fallback)

---

## 🛠️ Manual Fix (Jika Script Gagal)

### Step 1: Fix node-gyp
```bash
mkdir -p ~/.gyp
cat > ~/.gyp/include.gypi << 'EOF'
{
    'variables': {
        'android_ndk_path': ''
    }
}
EOF
```

### Step 2: Install dependencies
```bash
pkg update
pkg install python build-essential clang make libsqlite sqlite
```

### Step 3: Install npm packages (no optional first)
```bash
npm install --no-optional
```

### Step 4: Try better-sqlite3
```bash
npm install better-sqlite3
```
Jika gagal, coba sqlite3:
```bash
npm install sqlite3
```
Jika masih gagal, app akan otomatis pakai JSON storage.

### Step 5: Start server
```bash
npm start
```

---

## 📦 Tanpa SQLite (Mode JSON)

Jika SQLite benar-benar tidak bisa di-install, app akan otomatis pakai **JSON file storage**.

- Data disimpan di `darknet.json`
- Cocok untuk testing/development
- **Tidak recommended untuk production**

---

## 🌐 Akses dari HP Lain (Same WiFi)

1. Cek IP HP lo:
```bash
ifconfig wlan0
# atau
ip addr show wlan0
```

2. Start server dengan IP:
```bash
HOST=0.0.0.0 npm start
```

3. Akses dari HP lain:
```
http://YOUR_PHONE_IP:3000
```

---

## 🔧 Tips Termux

### Keep server running (background)
```bash
# Install tmux
pkg install tmux

# Start session
tmux new -s darknet
npm start

# Detach: Ctrl+B, D
# Reattach: tmux attach -t darknet
```

### Auto-start on Termux boot
```bash
# Install termux-api
pkg install termux-api

# Add to ~/.bashrc
echo "cd ~/darknet_chat && npm start &" >> ~/.bashrc
```

---

## ⚠️ Limitasi Termux

| Fitur | Status |
|-------|--------|
| SQLite | ✅ Work (dengan fix) |
| File Upload | ✅ Work |
| Real-time Chat | ✅ Work |
| PWA Install | ✅ Work (Chrome Android) |
| APK Build | ⚠️ Butuh Linux/PC (Bubblewrap) |
| Background Service | ⚠️ Butuh tmux/termux-wake-lock |

---

## 🔄 Troubleshooting

### Error: "Cannot find module 'express'"
→ `npm install` belum jalan. Ulangi Step 3.

### Error: "Permission denied"
→ `chmod +x termux-fix.sh` sebelum run.

### Error: "Port already in use"
→ `killall node` atau ganti PORT di `.env`

### Server mati saat screen off
→ `termux-wake-lock` sebelum start server.

---

**Built by Antu.py | Project: ShadowKeep**
