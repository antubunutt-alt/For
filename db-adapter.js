// Database Adapter - Auto-detects available SQLite driver
// Supports: better-sqlite3, sqlite3, or JSON fallback

const fs = require('fs');
const path = require('path');

let db;
let dbType;

function initDatabase() {
    // Try better-sqlite3 first (fastest, synchronous)
    try {
        const Database = require('better-sqlite3');
        db = new Database('./darknet.db');
        dbType = 'better-sqlite3';
        console.log('[+] Using better-sqlite3 (fastest)');
        return setupBetterSQLite();
    } catch (e) {
        console.log('[!] better-sqlite3 not available:', e.message);
    }

    // Fallback to sqlite3 (async, widely supported)
    try {
        const sqlite3 = require('sqlite3').verbose();
        db = new sqlite3.Database('./darknet.db');
        dbType = 'sqlite3';
        console.log('[+] Using sqlite3 (fallback)');
        return setupSQLite3();
    } catch (e) {
        console.log('[!] sqlite3 not available:', e.message);
    }

    // Final fallback: JSON file storage
    console.log('[!] Using JSON storage (development mode)');
    dbType = 'json';
    return setupJSON();
}

// better-sqlite3 setup (synchronous API)
function setupBetterSQLite() {
    const setup = {
        type: 'better-sqlite3',

        run: (sql, params = []) => {
            try {
                const stmt = db.prepare(sql);
                const result = stmt.run(params);
                return { lastID: result.lastInsertRowid, changes: result.changes };
            } catch (e) {
                console.error('DB Error:', e.message);
                throw e;
            }
        },

        get: (sql, params = []) => {
            try {
                const stmt = db.prepare(sql);
                return stmt.get(params) || null;
            } catch (e) {
                console.error('DB Error:', e.message);
                return null;
            }
        },

        all: (sql, params = []) => {
            try {
                const stmt = db.prepare(sql);
                return stmt.all(params);
            } catch (e) {
                console.error('DB Error:', e.message);
                return [];
            }
        },

        exec: (sql) => {
            db.exec(sql);
        },

        close: () => {
            db.close();
        }
    };

    // Create tables
    setup.exec(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT,
        bio TEXT DEFAULT '',
        avatar TEXT DEFAULT '/uploads/default-avatar.png',
        status TEXT DEFAULT 'offline',
        status_message TEXT DEFAULT '',
        pin_code TEXT UNIQUE,
        is_banned INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    setup.exec(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        receiver_id INTEGER,
        content TEXT,
        file_url TEXT,
        file_name TEXT,
        file_type TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    setup.exec(`CREATE TABLE IF NOT EXISTS forum_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        content TEXT,
        category TEXT DEFAULT 'general',
        is_pinned INTEGER DEFAULT 0,
        is_locked INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    setup.exec(`CREATE TABLE IF NOT EXISTS forum_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        user_id INTEGER,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    setup.exec(`CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        connected_user_id INTEGER,
        pin_code TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    setup.exec(`CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT,
        target_user TEXT,
        admin_username TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    return setup;
}

// sqlite3 setup (async API with callbacks)
function setupSQLite3() {
    const setup = {
        type: 'sqlite3',

        run: (sql, params = []) => {
            return new Promise((resolve, reject) => {
                db.run(sql, params, function(err) {
                    if (err) {
                        console.error('DB Error:', err.message);
                        reject(err);
                    } else {
                        resolve({ lastID: this.lastID, changes: this.changes });
                    }
                });
            });
        },

        get: (sql, params = []) => {
            return new Promise((resolve, reject) => {
                db.get(sql, params, (err, row) => {
                    if (err) {
                        console.error('DB Error:', err.message);
                        resolve(null);
                    } else {
                        resolve(row || null);
                    }
                });
            });
        },

        all: (sql, params = []) => {
            return new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err) {
                        console.error('DB Error:', err.message);
                        resolve([]);
                    } else {
                        resolve(rows || []);
                    }
                });
            });
        },

        exec: (sql) => {
            return new Promise((resolve, reject) => {
                db.exec(sql, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        },

        close: () => {
            db.close();
        }
    };

    // Create tables (using exec which is sync in sqlite3)
    db.exec(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT,
        bio TEXT DEFAULT '',
        avatar TEXT DEFAULT '/uploads/default-avatar.png',
        status TEXT DEFAULT 'offline',
        status_message TEXT DEFAULT '',
        pin_code TEXT UNIQUE,
        is_banned INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        receiver_id INTEGER,
        content TEXT,
        file_url TEXT,
        file_name TEXT,
        file_type TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS forum_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        content TEXT,
        category TEXT DEFAULT 'general',
        is_pinned INTEGER DEFAULT 0,
        is_locked INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS forum_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        user_id INTEGER,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        connected_user_id INTEGER,
        pin_code TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT,
        target_user TEXT,
        admin_username TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    return setup;
}

// JSON fallback (for development when no SQLite available)
function setupJSON() {
    const dbPath = './darknet.json';
    let data = { 
        users: [], 
        messages: [], 
        forum_posts: [], 
        forum_replies: [], 
        connections: [], 
        admin_logs: [] 
    };
    let nextId = { 
        users: 1, 
        messages: 1, 
        forum_posts: 1, 
        forum_replies: 1, 
        connections: 1, 
        admin_logs: 1 
    };

    // Load existing data
    if (fs.existsSync(dbPath)) {
        try {
            const saved = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            data = saved;
            // Calculate next IDs
            for (const table of Object.keys(data)) {
                if (data[table] && data[table].length > 0) {
                    const maxId = Math.max(...data[table].map(r => r.id || 0));
                    nextId[table] = maxId + 1;
                }
            }
            console.log('[JSON] Loaded existing data, users:', data.users.length);
        } catch (e) {
            console.log('[JSON] Could not load existing data, starting fresh');
        }
    }

    const save = () => {
        try {
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('[JSON] Save failed:', e.message);
        }
    };

    // Parse WHERE clause from SQL
    function parseWhere(sql, params) {
        const conditions = [];

        // Match WHERE column = ?
        const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s+OFFSET|$)/i);
        if (!whereMatch) return null;

        const whereClause = whereMatch[1].trim();

        // Handle simple equality: column = ?
        const eqMatches = [...whereClause.matchAll(/(\w+)\s*=\s*\?/gi)];
        eqMatches.forEach((match, idx) => {
            conditions.push({
                column: match[1],
                value: params[idx],
                operator: '='
            });
        });

        // Handle AND/OR
        if (whereClause.includes('AND') || whereClause.includes('OR')) {
            // For complex queries, try to extract all conditions
            const allMatches = [...whereClause.matchAll(/(\w+)\s*=\s*\?/gi)];
            allMatches.forEach((match, idx) => {
                if (!conditions.find(c => c.column === match[1])) {
                    conditions.push({
                        column: match[1],
                        value: params[idx] !== undefined ? params[idx] : params[conditions.length],
                        operator: '='
                    });
                }
            });
        }

        return conditions;
    }

    // Parse ORDER BY
    function parseOrderBy(sql) {
        const match = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
        if (!match) return null;
        return {
            column: match[1],
            direction: (match[2] || 'ASC').toUpperCase()
        };
    }

    // Parse LIMIT/OFFSET
    function parseLimit(sql) {
        const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
        const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
        return {
            limit: limitMatch ? parseInt(limitMatch[1]) : null,
            offset: offsetMatch ? parseInt(offsetMatch[1]) : 0
        };
    }

    const setup = {
        type: 'json',

        run: (sql, params = []) => {
            sql = sql.trim();

            // INSERT
            if (sql.toUpperCase().startsWith('INSERT')) {
                const tableMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
                if (!tableMatch) return { lastID: 0, changes: 0 };

                const table = tableMatch[1];
                const colMatch = sql.match(/\(([^)]+)\)/);

                if (colMatch) {
                    const cols = colMatch[1].split(',').map(c => c.trim());
                    const id = nextId[table]++;
                    const row = { id };

                    cols.forEach((col, i) => {
                        if (col !== 'id' && col !== 'created_at') {
                            row[col] = params[i] !== undefined ? params[i] : null;
                        }
                    });

                    if (!cols.includes('created_at')) {
                        row.created_at = new Date().toISOString();
                    }

                    if (!data[table]) data[table] = [];
                    data[table].push(row);
                    save();
                    return { lastID: id, changes: 1 };
                }
            }

            // UPDATE
            if (sql.toUpperCase().startsWith('UPDATE')) {
                const tableMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
                if (!tableMatch) return { changes: 0 };

                const table = tableMatch[1];
                const setClause = tableMatch[2];
                const whereClause = tableMatch[3];

                // Parse SET columns
                const setMatches = [...setClause.matchAll(/(\w+)\s*=\s*\?/gi)];
                const setCols = setMatches.map(m => m[1]);

                // Parse WHERE
                const whereMatch = whereClause.match(/(\w+)\s*=\s*\?/);
                const whereCol = whereMatch ? whereMatch[1] : 'id';
                const whereVal = params[setCols.length];

                let changes = 0;
                if (data[table]) {
                    data[table].forEach(row => {
                        if (String(row[whereCol]) === String(whereVal)) {
                            setCols.forEach((col, i) => {
                                row[col] = params[i];
                            });
                            changes++;
                        }
                    });
                }

                save();
                return { changes };
            }

            // DELETE
            if (sql.toUpperCase().startsWith('DELETE')) {
                const tableMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
                if (!tableMatch) return { changes: 0 };

                const table = tableMatch[1];
                const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);

                if (whereMatch && data[table]) {
                    const whereCol = whereMatch[1];
                    const whereVal = params[0];
                    const initialLen = data[table].length;
                    data[table] = data[table].filter(row => String(row[whereCol]) !== String(whereVal));
                    const changes = initialLen - data[table].length;
                    save();
                    return { changes };
                }

                return { changes: 0 };
            }

            return { changes: 0 };
        },

        get: (sql, params = []) => {
            const table = extractTable(sql);
            if (!table || !data[table]) return null;

            const conditions = parseWhere(sql, params);
            if (!conditions || conditions.length === 0) {
                return data[table][0] || null;
            }

            return data[table].find(row => {
                return conditions.every(cond => {
                    const rowVal = String(row[cond.column] || '');
                    const condVal = String(cond.value || '');
                    return rowVal === condVal;
                });
            }) || null;
        },

        all: (sql, params = []) => {
            const table = extractTable(sql);
            if (!table || !data[table]) return [];

            let rows = [...data[table]];

            // Apply WHERE
            const conditions = parseWhere(sql, params);
            if (conditions && conditions.length > 0) {
                rows = rows.filter(row => {
                    return conditions.every(cond => {
                        const rowVal = String(row[cond.column] || '');
                        const condVal = String(cond.value || '');
                        return rowVal === condVal;
                    });
                });
            }

            // Apply ORDER BY
            const orderBy = parseOrderBy(sql);
            if (orderBy) {
                rows.sort((a, b) => {
                    const aVal = a[orderBy.column] || '';
                    const bVal = b[orderBy.column] || '';
                    if (orderBy.direction === 'DESC') {
                        return String(bVal).localeCompare(String(aVal));
                    }
                    return String(aVal).localeCompare(String(bVal));
                });
            }

            // Apply LIMIT/OFFSET
            const limitInfo = parseLimit(sql);
            if (limitInfo.limit !== null) {
                rows = rows.slice(limitInfo.offset, limitInfo.offset + limitInfo.limit);
            }

            return rows;
        },

        exec: (sql) => {
            if (sql.toUpperCase().includes('CREATE TABLE')) return;

            const dropMatch = sql.match(/DROP\s+TABLE\s+(\w+)/i);
            if (dropMatch) {
                data[dropMatch[1]] = [];
                save();
            }
        },

        close: () => {
            save();
        },

        // Debug helper
        _debug: () => {
            return { data, nextId };
        }
    };

    return setup;
}

function extractTable(sql) {
    const match = sql.match(/FROM\s+(\w+)/i) || 
                  sql.match(/INTO\s+(\w+)/i) || 
                  sql.match(/UPDATE\s+(\w+)/i);
    return match ? match[1] : null;
}

module.exports = { initDatabase };
