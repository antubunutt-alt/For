const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { initDatabase } = require('./db-adapter');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'shadowkeep_darknet_2026_antu_py_infinity';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$EwrGfsF5lL7k3IeGyrnG9.4sUM8Du.hgIxl4KVo1Yu8gOGod1xYXe';

// Middleware
app.use(helmet({ 
    contentSecurityPolicy: false, 
    crossOriginEmbedderPolicy: false 
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// Favicon handler - prevents 404 errors
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Initialize Database
let db;
try {
    db = initDatabase();
    console.log(`[+] Database initialized: ${db.type}`);
} catch (err) {
    console.error('[!] Database initialization failed:', err.message);
    process.exit(1);
}

// Generate 8-digit PIN
function generatePinCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pin = '';
    for (let i = 0; i < 8; i++) {
        pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pin;
}

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Admin auth middleware
const authenticateAdmin = (req, res, next) => {
    const { username, password } = req.body;
    if (username !== ADMIN_USERNAME) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    bcrypt.compare(password, ADMIN_PASSWORD_HASH, (err, result) => {
        if (err || !result) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }
        req.isAdmin = true;
        next();
    });
};

// File upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => { 
        cb(null, 'public/uploads/'); 
    },
    filename: (req, file, cb) => { 
        cb(null, uuidv4() + path.extname(file.originalname)); 
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Helper for async DB operations
async function dbRun(sql, params) {
    if (db.type === 'better-sqlite3') {
        return db.run(sql, params);
    } else {
        return await db.run(sql, params);
    }
}

async function dbGet(sql, params) {
    if (db.type === 'better-sqlite3') {
        return db.get(sql, params);
    } else {
        return await db.get(sql, params);
    }
}

async function dbAll(sql, params) {
    if (db.type === 'better-sqlite3') {
        return db.all(sql, params);
    } else {
        return await db.all(sql, params);
    }
}

// Insert default admin
(async () => {
    try {
        const admin = await dbGet('SELECT * FROM users WHERE username = ?', [ADMIN_USERNAME]);
        if (!admin) {
            const result = await dbRun(
                'INSERT INTO users (username, password, display_name, pin_code) VALUES (?, ?, ?, ?)',
                [ADMIN_USERNAME, ADMIN_PASSWORD_HASH, 'System Administrator', generatePinCode()]
            );
            console.log('[+] Default admin created with ID:', result.lastID);
        } else {
            console.log('[+] Admin already exists');
        }
    } catch (e) {
        console.log('[!] Admin check error:', e.message);
    }
})();

// ============= ROUTES =============

app.get('/', (req, res) => { 
    res.render('index'); 
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        db_type: db.type,
        timestamp: new Date().toISOString() 
    });
});

// Debug endpoint - list all users with PINs (NO AUTH - for debugging only)
app.get('/api/debug/users', async (req, res) => {
    try {
        const users = await dbAll('SELECT id, username, display_name, pin_code, status FROM users', []);
        res.json({ count: users.length, users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Register
app.post('/api/register', async (req, res) => {
    console.log('[REGISTER] Request body:', req.body);
    const { username, password, display_name } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const pinCode = generatePinCode();

    try {
        const result = await dbRun(
            'INSERT INTO users (username, password, display_name, pin_code) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, display_name || username, pinCode]
        );

        console.log('[REGISTER] User created, ID:', result.lastID);
        const token = jwt.sign({ userId: result.lastID, username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: { id: result.lastID, username, pin_code: pinCode },
            message: 'Registration successful. Save your PIN: ' + pinCode
        });
    } catch (err) {
        console.error('[REGISTER] Error:', err.message);
        if (err.message && (err.message.includes('UNIQUE constraint failed') || err.message.includes('already exists'))) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    console.log('[LOGIN] Request body:', req.body);
    const { username, password } = req.body;

    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        console.log('[LOGIN] User found:', user ? 'YES' : 'NO');

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        if (user.is_banned) {
            return res.status(403).json({ error: 'Account banned' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        console.log('[LOGIN] Password valid:', validPassword);

        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        await dbRun('UPDATE users SET status = ? WHERE id = ?', ['online', user.id]);

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                pin_code: user.pin_code,
                avatar: user.avatar,
                bio: user.bio,
                status_message: user.status_message
            }
        });
    } catch (err) {
        console.error('[LOGIN] Error:', err.message);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// Profile
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await dbGet(
            'SELECT id, username, display_name, bio, avatar, status, status_message, pin_code, created_at FROM users WHERE id = ?', 
            [req.user.userId]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/profile/update', authenticateToken, upload.single('avatar'), async (req, res) => {
    const { display_name, bio, status_message } = req.body;
    const avatar = req.file ? '/uploads/' + req.file.filename : undefined;

    let query = 'UPDATE users SET display_name = ?, bio = ?, status_message = ?';
    let params = [display_name, bio, status_message];

    if (avatar) {
        query += ', avatar = ?';
        params.push(avatar);
    }
    query += ' WHERE id = ?';
    params.push(req.user.userId);

    try {
        await dbRun(query, params);
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Update failed: ' + err.message });
    }
});

// Change password
app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { current_password, new_password } = req.body;

    try {
        const user = await dbGet('SELECT password FROM users WHERE id = ?', [req.user.userId]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(current_password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.userId]);
        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Password change failed: ' + err.message });
    }
});

// PIN-based user search
app.get('/api/user/pin/:pin', authenticateToken, async (req, res) => {
    try {
        const user = await dbGet(
            'SELECT id, username, display_name, avatar, status, status_message, pin_code FROM users WHERE pin_code = ?', 
            [req.params.pin]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Connect by PIN
// Send connection request
app.post('/api/connect/request', authenticateToken, async (req, res) => {
    const { pin_code } = req.body;
    console.log('[CONNECT REQUEST] PIN:', pin_code, 'From user:', req.user.userId);

    try {
        const targetUser = await dbGet('SELECT id, username, display_name, pin_code FROM users WHERE pin_code = ?', [pin_code]);
        console.log('[CONNECT REQUEST] Target:', targetUser);

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (targetUser.id === req.user.userId) {
            return res.status(400).json({ error: 'Cannot connect with yourself' });
        }

        // Check if already connected or pending
        const existing = await dbGet(
            'SELECT * FROM connections WHERE ((user_id = ? AND connected_user_id = ?) OR (user_id = ? AND connected_user_id = ?))',
            [req.user.userId, targetUser.id, targetUser.id, req.user.userId]
        );

        if (existing) {
            if (existing.status === 'pending') {
                return res.status(400).json({ error: 'Connection request already pending' });
            }
            return res.status(400).json({ error: 'Already connected' });
        }

        // Create pending connection request
        const connectionPin = generatePinCode();
        const result = await dbRun(
            'INSERT INTO connections (user_id, connected_user_id, pin_code, status) VALUES (?, ?, ?, ?)',
            [req.user.userId, targetUser.id, connectionPin, 'pending']
        );

        // Notify target user via socket
        io.to(`user_${targetUser.id}`).emit('connection_request', {
            id: result.lastID,
            from_user: {
                id: req.user.userId,
                username: req.user.username
            },
            connection_pin: connectionPin
        });

        console.log('[CONNECT REQUEST] Sent to user:', targetUser.id);
        res.json({ message: 'Connection request sent', connection_id: result.lastID });
    } catch (err) {
        console.error('[CONNECT REQUEST] Error:', err.message);
        res.status(500).json({ error: 'Connection request failed: ' + err.message });
    }
});

// Accept connection request
app.post('/api/connect/accept', authenticateToken, async (req, res) => {
    const { connection_id } = req.body;
    console.log('[CONNECT ACCEPT] ID:', connection_id, 'By user:', req.user.userId);

    try {
        const connection = await dbGet('SELECT * FROM connections WHERE id = ? AND connected_user_id = ? AND status = ?',
            [connection_id, req.user.userId, 'pending']);

        if (!connection) {
            return res.status(404).json({ error: 'Connection request not found' });
        }

        await dbRun('UPDATE connections SET status = ? WHERE id = ?', ['accepted', connection_id]);

        // Notify both users
        io.to(`user_${connection.user_id}`).emit('connection_accepted', {
            connection_id,
            by_user: req.user.userId
        });

        io.to(`user_${req.user.userId}`).emit('connection_accepted', {
            connection_id,
            by_user: req.user.userId
        });

        res.json({ message: 'Connection accepted' });
    } catch (err) {
        console.error('[CONNECT ACCEPT] Error:', err.message);
        res.status(500).json({ error: 'Accept failed: ' + err.message });
    }
});

// Reject connection request
app.post('/api/connect/reject', authenticateToken, async (req, res) => {
    const { connection_id } = req.body;

    try {
        await dbRun('DELETE FROM connections WHERE id = ? AND connected_user_id = ? AND status = ?',
            [connection_id, req.user.userId, 'pending']);
        res.json({ message: 'Connection rejected' });
    } catch (err) {
        res.status(500).json({ error: 'Reject failed: ' + err.message });
    }
});

// Get pending connection requests
app.get('/api/connect/pending', authenticateToken, async (req, res) => {
    try {
        const pending = await dbAll(
            'SELECT c.*, u.username, u.display_name, u.avatar FROM connections c ' +
            'JOIN users u ON c.user_id = u.id ' +
            'WHERE c.connected_user_id = ? AND c.status = ?',
            [req.user.userId, 'pending']
        );
        res.json(pending);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load pending: ' + err.message });
    }
});

// Get connections
app.get('/api/connections', authenticateToken, async (req, res) => {
    try {
        // Get connections where current user is the initiator
        const connections1 = await dbAll(
            'SELECT u.id, u.username, u.display_name, u.avatar, u.status, c.pin_code, c.created_at ' +
            'FROM connections c JOIN users u ON c.connected_user_id = u.id ' +
            'WHERE c.user_id = ? AND c.status = ?',
            [req.user.userId, 'accepted']
        );

        // Get connections where current user is the target
        const connections2 = await dbAll(
            'SELECT u.id, u.username, u.display_name, u.avatar, u.status, c.pin_code, c.created_at ' +
            'FROM connections c JOIN users u ON c.user_id = u.id ' +
            'WHERE c.connected_user_id = ? AND c.status = ?',
            [req.user.userId, 'accepted']
        );

        // Combine and remove duplicates
        const allConnections = [...connections1, ...connections2];
        const uniqueConnections = [];
        const seen = new Set();

        for (const conn of allConnections) {
            if (!seen.has(conn.id)) {
                seen.add(conn.id);
                uniqueConnections.push(conn);
            }
        }

        console.log('[CONNECTIONS] Found', uniqueConnections.length, 'connections');
        res.json(uniqueConnections);
    } catch (err) {
        console.error('[CONNECTIONS] Error:', err.message);
        res.status(500).json({ error: 'Failed to load connections: ' + err.message });
    }
});

// Send message
app.post('/api/messages/send', authenticateToken, upload.single('file'), async (req, res) => {
    const { receiver_id, content } = req.body;
    const fileUrl = req.file ? '/uploads/' + req.file.filename : null;
    const fileName = req.file ? req.file.originalname : null;
    const fileType = req.file ? req.file.mimetype : null;

    console.log('[SEND_MSG] From:', req.user.userId, 'To:', receiver_id, 'Content:', content ? content.substring(0, 50) : '(file)');

    try {
        const result = await dbRun(
            'INSERT INTO messages (sender_id, receiver_id, content, file_url, file_name, file_type) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.userId, receiver_id, content || '', fileUrl, fileName, fileType]
        );

        // Get sender info for the message
        const sender = await dbGet('SELECT username, display_name, avatar FROM users WHERE id = ?', [req.user.userId]);

        const message = {
            id: result.lastID,
            sender_id: req.user.userId,
            receiver_id: parseInt(receiver_id),
            sender_name: sender ? (sender.display_name || sender.username) : 'Unknown',
            sender_avatar: sender ? sender.avatar : '/uploads/default-avatar.png',
            content: content || '',
            file_url: fileUrl,
            file_name: fileName,
            file_type: fileType,
            is_read: 0,
            created_at: new Date().toISOString()
        };

        // Emit to both sender and receiver rooms
        console.log('[SEND_MSG] Emitting to rooms:', `user_${receiver_id}`, `user_${req.user.userId}`);
        io.to(`user_${receiver_id}`).emit('new_message', message);
        io.to(`user_${req.user.userId}`).emit('new_message', message);

        res.json({ message: 'Message sent', data: message });
    } catch (err) {
        console.error('[SEND_MSG] Error:', err.message);
        res.status(500).json({ error: 'Message failed: ' + err.message });
    }
});

// Get chat history
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
    try {
        const messages = await dbAll(`
            SELECT m.*, 
                   s.username as sender_name, s.display_name as sender_display_name, s.avatar as sender_avatar,
                   r.username as receiver_name, r.display_name as receiver_display_name, r.avatar as receiver_avatar
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            JOIN users r ON m.receiver_id = r.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC
        `, [req.user.userId, req.params.userId, req.params.userId, req.user.userId]);

        console.log('[GET_MSGS] Found', messages.length, 'messages between', req.user.userId, 'and', req.params.userId);
        res.json(messages);
    } catch (err) {
        console.error('[GET_MSGS] Error:', err.message);
        res.status(500).json({ error: 'Failed to load messages: ' + err.message });
    }
});

// Mark as read
app.post('/api/messages/read/:senderId', authenticateToken, async (req, res) => {
    try {
        await dbRun('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?',
            [req.params.senderId, req.user.userId]);
        res.json({ message: 'Messages marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Accept connection request
app.post('/api/connections/accept', authenticateToken, async (req, res) => {
    const { connection_id } = req.body;

    try {
        const conn = await dbGet('SELECT * FROM connections WHERE id = ? AND connected_user_id = ? AND status = ?',
            [connection_id, req.user.userId, 'pending']);

        if (!conn) {
            return res.status(404).json({ error: 'Connection request not found' });
        }

        await dbRun('UPDATE connections SET status = ? WHERE id = ?', ['accepted', connection_id]);

        // Notify both users
        io.to(`user_${conn.user_id}`).emit('connection_accepted', {
            connection_id,
            by_user: req.user.userId
        });

        io.to(`user_${conn.connected_user_id}`).emit('connection_accepted', {
            connection_id,
            by_user: req.user.userId
        });

        res.json({ message: 'Connection accepted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reject connection request
app.post('/api/connections/reject', authenticateToken, async (req, res) => {
    const { connection_id } = req.body;

    try {
        const conn = await dbGet('SELECT * FROM connections WHERE id = ? AND connected_user_id = ? AND status = ?',
            [connection_id, req.user.userId, 'pending']);

        if (!conn) {
            return res.status(404).json({ error: 'Connection request not found' });
        }

        await dbRun('UPDATE connections SET status = ? WHERE id = ?', ['rejected', connection_id]);

        io.to(`user_${conn.user_id}`).emit('connection_rejected', {
            connection_id,
            by_user: req.user.userId
        });

        res.json({ message: 'Connection rejected' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get pending connection requests
app.get('/api/connections/pending', authenticateToken, async (req, res) => {
    try {
        const requests = await dbAll(`
            SELECT c.*, u.username, u.display_name, u.avatar
            FROM connections c
            JOIN users u ON c.user_id = u.id
            WHERE c.connected_user_id = ? AND c.status = 'pending'
            ORDER BY c.created_at DESC
        `, [req.user.userId]);

        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= FORUM =============

app.post('/api/forum/post', authenticateToken, async (req, res) => {
    const { title, content, category } = req.body;

    try {
        const result = await dbRun(
            'INSERT INTO forum_posts (user_id, title, content, category) VALUES (?, ?, ?, ?)',
            [req.user.userId, title, content, category || 'general']
        );
        res.json({ message: 'Post created', post_id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Post creation failed: ' + err.message });
    }
});

app.get('/api/forum/posts', async (req, res) => {
    const { category, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    try {
        let query = `
            SELECT fp.*, u.username, u.display_name, u.avatar,
                   (SELECT COUNT(*) FROM forum_replies WHERE post_id = fp.id) as reply_count
            FROM forum_posts fp
            JOIN users u ON fp.user_id = u.id
        `;
        let params = [];

        if (category && category !== 'all') {
            query += ' WHERE fp.category = ?';
            params.push(category);
        }

        query += ' ORDER BY fp.is_pinned DESC, fp.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const posts = await dbAll(query, params);
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load posts: ' + err.message });
    }
});

app.get('/api/forum/post/:id', async (req, res) => {
    try {
        const post = await dbGet(`
            SELECT fp.*, u.username, u.display_name, u.avatar
            FROM forum_posts fp
            JOIN users u ON fp.user_id = u.id
            WHERE fp.id = ?
        `, [req.params.id]);

        if (!post) return res.status(404).json({ error: 'Post not found' });

        const replies = await dbAll(`
            SELECT fr.*, u.username, u.display_name, u.avatar
            FROM forum_replies fr
            JOIN users u ON fr.user_id = u.id
            WHERE fr.post_id = ?
            ORDER BY fr.created_at ASC
        `, [req.params.id]);

        res.json({ post, replies });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load post: ' + err.message });
    }
});

app.post('/api/forum/reply', authenticateToken, async (req, res) => {
    const { post_id, content } = req.body;

    try {
        const result = await dbRun(
            'INSERT INTO forum_replies (post_id, user_id, content) VALUES (?, ?, ?)',
            [post_id, req.user.userId, content]
        );
        res.json({ message: 'Reply posted', reply_id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Reply failed: ' + err.message });
    }
});

// ============= ADMIN =============

app.post('/api/admin/login', authenticateAdmin, (req, res) => {
    const token = jwt.sign({ admin: true, username: ADMIN_USERNAME }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, message: 'Admin authenticated' });
});

const adminAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err || !user.admin) return res.sendStatus(403);
        req.admin = user;
        next();
    });
};

app.get('/api/admin/users', adminAuth, async (req, res) => {
    try {
        const users = await dbAll('SELECT id, username, display_name, pin_code, status, is_banned, created_at FROM users');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load users: ' + err.message });
    }
});

app.post('/api/admin/user/update', adminAuth, async (req, res) => {
    const { user_id, display_name, is_banned, new_password } = req.body;

    let query = 'UPDATE users SET display_name = ?, is_banned = ?';
    let params = [display_name, is_banned ? 1 : 0];

    if (new_password) {
        const hashedPassword = await bcrypt.hash(new_password, 10);
        query += ', password = ?';
        params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(user_id);

    try {
        await dbRun(query, params);
        await dbRun(
            'INSERT INTO admin_logs (action, target_user, admin_username, details) VALUES (?, ?, ?, ?)',
            ['update_user', user_id, req.admin.username, JSON.stringify(req.body)]
        );
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Update failed: ' + err.message });
    }
});

app.post('/api/admin/user/delete', adminAuth, async (req, res) => {
    const { user_id } = req.body;

    try {
        await dbRun('DELETE FROM users WHERE id = ?', [user_id]);
        await dbRun(
            'INSERT INTO admin_logs (action, target_user, admin_username, details) VALUES (?, ?, ?, ?)',
            ['delete_user', user_id, req.admin.username, 'User deleted']
        );
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed: ' + err.message });
    }
});


// Admin broadcast message to all users
app.post('/api/admin/broadcast', adminAuth, async (req, res) => {
    const { message, type = 'info' } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    try {
        // Emit to all connected sockets
        io.emit('admin_broadcast', {
            message,
            type,
            timestamp: new Date().toISOString(),
            from: req.admin.username
        });

        // Log the broadcast
        await dbRun(
            'INSERT INTO admin_logs (action, target_user, admin_username, details) VALUES (?, ?, ?, ?)',
            ['broadcast', 'all', req.admin.username, message]
        );

        res.json({ message: 'Broadcast sent to all users' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/logs', adminAuth, async (req, res) => {
    try {
        const logs = await dbAll('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 100');
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load logs: ' + err.message });
    }
});

// Admin broadcast message to all users
app.post('/api/admin/broadcast', adminAuth, async (req, res) => {
    const { title, message, type = 'info' } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    try {
        // Emit to all connected sockets
        io.emit('admin_broadcast', {
            title: title || 'System Message',
            message,
            type,
            timestamp: new Date().toISOString()
        });

        await dbRun(
            'INSERT INTO admin_logs (action, target_user, admin_username, details) VALUES (?, ?, ?, ?)',
            ['broadcast', 'all', req.admin.username, JSON.stringify({ title, message, type })]
        );

        res.json({ message: 'Broadcast sent to all users' });
    } catch (err) {
        res.status(500).json({ error: 'Broadcast failed: ' + err.message });
    }
});

app.get('/api/admin/stats', adminAuth, async (req, res) => {
    try {
        const userCount = await dbGet('SELECT COUNT(*) as total_users FROM users');
        const postCount = await dbGet('SELECT COUNT(*) as total_posts FROM forum_posts');
        const msgCount = await dbGet('SELECT COUNT(*) as total_messages FROM messages');
        const onlineCount = await dbGet('SELECT COUNT(*) as online_users FROM users WHERE status = "online"');

        res.json({
            total_users: userCount ? userCount.total_users : 0,
            total_posts: postCount ? postCount.total_posts : 0,
            total_messages: msgCount ? msgCount.total_messages : 0,
            online_users: onlineCount ? onlineCount.online_users : 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load stats: ' + err.message });
    }
});

// ============= SOCKET.IO =============

const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('authenticate', (token) => {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err && user) {
                socket.userId = user.userId;
                socket.join(`user_${user.userId}`);
                onlineUsers.set(user.userId, socket.id);
                console.log(`[SOCKET] User ${user.userId} authenticated, joined room user_${user.userId}`);

                dbRun('UPDATE users SET status = ? WHERE id = ?', ['online', user.userId]).catch(() => {});
                io.emit('user_status', { userId: user.userId, status: 'online' });
            } else {
                console.log('[SOCKET] Auth failed:', err ? err.message : 'no user');
            }
        });
    });

    socket.on('typing', (data) => {
        if (socket.userId) {
            io.to(`user_${data.receiver_id}`).emit('typing', {
                sender_id: socket.userId,
                is_typing: data.is_typing
            });
        }
    });

    socket.on('disconnect', () => {
        if (socket.userId) {
            onlineUsers.delete(socket.userId);
            dbRun('UPDATE users SET status = ? WHERE id = ?', ['offline', socket.userId]).catch(() => {});
            io.emit('user_status', { userId: socket.userId, status: 'offline' });
        }
    });
});

// ============= PWA MANIFEST =============
app.get('/manifest.json', (req, res) => {
    res.json({
        name: 'DarkNet Chat',
        short_name: 'DarkNet',
        description: 'Anonymous Darknet Forum Chat',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0a0a',
        theme_color: '#00ff41',
        orientation: 'portrait',
        icons: [
            { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
            { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
            { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
            { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
            { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
            { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
            { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
    });
});

server.listen(PORT, () => {
    console.log(`[+] DarkNet Chat Server running on port ${PORT}`);
    console.log(`[+] Database: ${db.type}`);
    console.log(`[+] Admin Panel: POST /api/admin/login (username: admin, password: admin123)`);
    console.log(`[+] PWA Manifest: GET /manifest.json`);
    console.log(`[+] Health Check: GET /api/health`);
});
