#!/bin/bash
# DarkNet Chat - Termux Fix Script
# Fixes sqlite3/better-sqlite3 compilation issues on Android/Termux

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         DARKNET CHAT - TERMUX FIX SCRIPT                     ║"
echo "║         Fixing SQLite compilation on Android...              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[*] Step 1: Fixing node-gyp configuration...${NC}"

# Create .gyp directory and config file to fix android_ndk_path issue
mkdir -p ~/.gyp
cat > ~/.gyp/include.gypi << 'EOF'
{
    'variables': {
        'android_ndk_path': ''
    }
}
EOF

echo -e "${GREEN}[+] Created ~/.gyp/include.gypi${NC}"

# Step 2: Install build dependencies
echo -e "${BLUE}[*] Step 2: Installing build dependencies...${NC}"
pkg update -y
pkg install -y python build-essential clang make libsqlite sqlite

echo -e "${GREEN}[+] Build dependencies installed${NC}"

# Step 3: Install Node.js dependencies WITHOUT optional deps first
echo -e "${BLUE}[*] Step 3: Installing core dependencies...${NC}"
npm install --no-optional

echo -e "${GREEN}[+] Core dependencies installed${NC}"

# Step 4: Try to install better-sqlite3 (preferred)
echo -e "${BLUE}[*] Step 4: Trying better-sqlite3 (fastest option)...${NC}"
npm install better-sqlite3

if [ $? -eq 0 ]; then
    echo -e "${GREEN}[+] better-sqlite3 installed successfully!${NC}"
    echo -e "${GREEN}[+] Using better-sqlite3 (synchronous, fastest)${NC}"
else
    echo -e "${YELLOW}[!] better-sqlite3 failed, trying sqlite3...${NC}"

    # Step 5: Fallback to sqlite3
    npm install sqlite3

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[+] sqlite3 installed successfully!${NC}"
        echo -e "${GREEN}[+] Using sqlite3 (async, compatible)${NC}"
    else
        echo -e "${YELLOW}[!] Both SQLite drivers failed${NC}"
        echo -e "${YELLOW}[!] Using JSON storage fallback (development mode)${NC}"
        echo -e "${YELLOW}[!] Data will be stored in darknet.json${NC}"
    fi
fi

# Step 6: Create uploads directory
mkdir -p public/uploads
echo -e "${GREEN}[+] Uploads directory ready${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    SETUP COMPLETE!                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Start server with:${NC}"
echo -e "  ${GREEN}npm start${NC}"
echo ""
echo -e "${YELLOW}Access URLs:${NC}"
echo -e "  Main App:    ${GREEN}http://localhost:3000${NC}"
echo -e "  Admin Panel: ${GREEN}http://localhost:3000/admin.html${NC}"
echo ""
echo -e "${YELLOW}Default Admin:${NC}"
echo -e "  Username: ${GREEN}admin${NC}"
echo -e "  Password: ${GREEN}admin123${NC}"
echo ""
