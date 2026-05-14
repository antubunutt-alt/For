// DarkNet Chat - Client Application
// Project: ShadowKeep v2.0

const API_BASE = '';
let currentUser = null;
let authToken = null;
let socket = null;
let currentChat = null;
let connections = [];
let messages = [];

// ===== UTILITY FUNCTIONS =====
function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function showToast(message, type = 'info') {
    const container = $('#toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ===== API FUNCTIONS =====
async function api(endpoint, options = {}) {
    const url = `${API_BASE}/api${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    if (authToken) {
        config.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }

    try {
        console.log(`[API] ${config.method || 'GET'} ${url}`, config.body ? JSON.parse(config.body) : '');
        const response = await fetch(url, config);
        const data = await response.json();

        console.log(`[API] Response:`, data);

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return data;
    } catch (error) {
        console.error('[API] Error:', error.message);
        showToast(error.message, 'error');
        throw error;
    }
}

// ===== AUTH FUNCTIONS =====
function initAuth() {
    console.log('[AUTH] Initializing auth screen...');

    // Ensure auth screen is visible
    const authScreen = $('#auth-screen');
    if (authScreen) {
        authScreen.classList.add('active');
        authScreen.style.display = 'flex';
    }

    // Tab switching
    $$('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.tab-btn').forEach(b => b.classList.remove('active'));
            $$('.auth-form').forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            const formId = `${btn.dataset.tab}-form`;
            const form = $(`#${formId}`);
            if (form) form.classList.add('active');
        });
    });

    // Login form
    const loginForm = $('#login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('[LOGIN] Form submitted');

            const usernameInput = $('#login-username');
            const passwordInput = $('#login-password');

            if (!usernameInput || !passwordInput) {
                showToast('Form elements not found', 'error');
                return;
            }

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (!username || !password) {
                showToast('Username and password required', 'error');
                return;
            }

            console.log('[LOGIN] Attempting login for:', username);

            try {
                const data = await api('/login', {
                    method: 'POST',
                    body: { username, password }
                });

                authToken = data.token;
                currentUser = data.user;
                localStorage.setItem('darknet_token', authToken);
                localStorage.setItem('darknet_user', JSON.stringify(currentUser));

                showToast('Access granted', 'success');
                initApp();
            } catch (error) {
                console.error('[LOGIN] Failed:', error);
            }
        });
    }

    // Register form
    const registerForm = $('#register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('[REGISTER] Form submitted');

            const usernameInput = $('#reg-username');
            const displayInput = $('#reg-display');
            const passwordInput = $('#reg-password');
            const confirmInput = $('#reg-password-confirm');

            if (!usernameInput || !passwordInput || !confirmInput) {
                showToast('Form elements not found', 'error');
                return;
            }

            const username = usernameInput.value.trim();
            const display_name = displayInput ? displayInput.value.trim() : username;
            const password = passwordInput.value;
            const confirm = confirmInput.value;

            if (!username || !password) {
                showToast('Username and password required', 'error');
                return;
            }

            if (password !== confirm) {
                showToast('Passwords do not match', 'error');
                return;
            }

            console.log('[REGISTER] Attempting registration for:', username);

            try {
                const data = await api('/register', {
                    method: 'POST',
                    body: { username, password, display_name }
                });

                authToken = data.token;
                currentUser = data.user;
                localStorage.setItem('darknet_token', authToken);
                localStorage.setItem('darknet_user', JSON.stringify(currentUser));

                showToast(`Identity created. PIN: ${data.user.pin_code}`, 'success');
                initApp();
            } catch (error) {
                console.error('[REGISTER] Failed:', error);
            }
        });
    }

    console.log('[AUTH] Auth initialization complete');
}

// ===== APP INITIALIZATION =====
function initApp() {
    console.log('[APP] Initializing main app...');

    const authScreen = $('#auth-screen');
    const mainScreen = $('#main-screen');

    if (authScreen) {
        authScreen.classList.remove('active');
        authScreen.style.display = 'none';
    }

    if (mainScreen) {
        mainScreen.classList.add('active');
        mainScreen.style.display = 'flex';
    }

    // Update sidebar
    const sidebarName = $('#sidebar-name');
    const sidebarUsername = $('#sidebar-username');
    const sidebarPin = $('#sidebar-pin');
    const sidebarAvatar = $('#sidebar-avatar');

    if (sidebarName) sidebarName.textContent = currentUser.display_name || currentUser.username;
    if (sidebarUsername) sidebarUsername.textContent = `@${currentUser.username}`;
    if (sidebarPin) sidebarPin.textContent = `PIN: ${currentUser.pin_code}`;
    if (sidebarAvatar) sidebarAvatar.src = currentUser.avatar || '/uploads/default-avatar.png';

    // Update profile view
    updateProfileView();

    // Init Socket.IO
    initSocket();

    // Load initial data
    loadConnections();
    loadForumPosts();

    // Setup navigation
    setupNavigation();

    // Setup chat
    setupChat();

    // Setup forum
    setupForum();

    // Setup profile
    setupProfile();

    // Setup settings
    setupSettings();

    // Setup modals
    setupModals();

    console.log('[APP] Main app initialized');
}

function initSocket() {
    try {
        socket = io();

        socket.on('connect', () => {
            console.log('[SOCKET] Connected');
            socket.emit('authenticate', authToken);
        });

        socket.on('new_message', (message) => {
            console.log('[SOCKET] New message:', message);

            // Check if this message is for current chat
            const isForCurrentChat = currentChat && (
                (message.sender_id === currentChat.id && message.receiver_id === currentUser.id) ||
                (message.sender_id === currentUser.id && message.receiver_id === currentChat.id)
            );

            if (isForCurrentChat) {
                console.log('[SOCKET] Appending to current chat');
                appendMessage(message);
                scrollToBottom();

                // Mark as read if we're the receiver
                if (message.receiver_id === currentUser.id) {
                    api(`/messages/read/${message.sender_id}`, { method: 'POST' }).catch(() => {});
                }
            } else {
                // Show notification for other chats
                showToast(`New message from ${message.sender_name || 'Unknown'}`, 'info');
            }

            updateChatBadge();
        });

        socket.on('user_status', (data) => {
            updateUserStatus(data.userId, data.status);
        });

        socket.on('typing', (data) => {
            if (currentChat && data.sender_id === currentChat.id) {
                const statusEl = $('#chat-status');
                if (statusEl) {
                    if (data.is_typing) {
                        statusEl.textContent = 'typing...';
                        statusEl.style.color = 'var(--accent-green)';
                    } else {
                        statusEl.textContent = 'online';
                        statusEl.style.color = 'var(--text-muted)';
                    }
                }
            }
        });

        socket.on('connect_error', (err) => {
            console.error('[SOCKET] Connection error:', err.message);
        });

        // Handle connection requests
        socket.on('connection_request', (data) => {
            console.log('[SOCKET] Connection request:', data);
            showToast(`Connection request from ${data.from_user.username}`, 'info');
            loadPendingRequests();
            updateConnectionBadge();
        });

        // Handle connection accepted
        socket.on('connection_accepted', (data) => {
            console.log('[SOCKET] Connection accepted:', data);
            showToast('Connection request accepted!', 'success');
            loadConnections();
        });

        // Handle connection rejected
        socket.on('connection_rejected', (data) => {
            console.log('[SOCKET] Connection rejected:', data);
            showToast('Connection request rejected', 'error');
        });

        // Handle admin broadcasts
        socket.on('admin_broadcast', (data) => {
            console.log('[SOCKET] Admin broadcast:', data);
            showToast(`[ADMIN] ${data.message}`, data.type || 'info');
        });
    } catch (err) {
        console.error('[SOCKET] Failed to initialize:', err.message);
    }
}

// ===== NAVIGATION =====
function setupNavigation() {
    // Menu toggle
    const menuToggle = $('#menu-toggle');
    const sidebar = $('#sidebar');
    const sidebarOverlay = $('#sidebar-overlay');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }

    // Nav items
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (!view) return;

            $$('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            $$('.view').forEach(v => v.classList.remove('active'));
            const targetView = $(`#${view}-view`);
            if (targetView) targetView.classList.add('active');

            if (sidebar) sidebar.classList.remove('open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');

            if (view === 'connections') {
                loadConnections();
                loadPendingRequests();
            }
            if (view === 'forum') loadForumPosts();
        });
    });

    // Logout
    const logoutBtn = $('#logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('darknet_token');
            localStorage.removeItem('darknet_user');
            authToken = null;
            currentUser = null;
            if (socket) socket.disconnect();
            location.reload();
        });
    }
}

// ===== CHAT FUNCTIONS =====
function setupChat() {
    // Chat view "New Connection" button
    const newChatBtn = $('#new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[UI] New chat button clicked');
            openModal('new-chat-modal');
        });
    }

    // Connections view "Add by PIN" button
    const addConnectionBtn = $('#add-connection-btn');
    if (addConnectionBtn) {
        addConnectionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[UI] Add by PIN button clicked');
            openModal('new-chat-modal');
        });
    }

    // Also attach via onclick attribute as fallback
    if (addConnectionBtn) {
        addConnectionBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[UI] Add by PIN onclick triggered');
            openModal('new-chat-modal');
            return false;
        };
    }

    const connectSubmit = $('#connect-submit');
    if (connectSubmit) {
        connectSubmit.addEventListener('click', async () => {
            const pinInput = $('#connect-pin');
            if (!pinInput) return;

            const pin = pinInput.value.toUpperCase().trim();
            if (pin.length !== 8) {
                showToast('PIN must be 8 characters', 'error');
                return;
            }

            try {
                await api('/connect/request', {
                    method: 'POST',
                    body: { pin_code: pin }
                });
                showToast('Connection request sent! Waiting for acceptance.', 'success');
                closeModal();
            } catch (error) {
                console.error('Connection request failed:', error);
            }
        });
    }

    // File attachment
    const attachBtn = $('#attach-btn');
    const fileInput = $('#file-input');
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file && currentChat) {
                sendMessage(null, file);
            }
        });
    }

    // Send message
    const sendBtn = $('#send-btn');
    const messageInput = $('#message-input');
    const chatInputArea = $('#chat-input-area');

    if (sendBtn) {
        sendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!messageInput) return;
            const content = messageInput.value.trim();
            if (content && currentChat) {
                sendMessage(content);
                messageInput.value = '';
                messageInput.focus(); // Keep focus on input
            }
        });
    }

    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (sendBtn) sendBtn.click();
            }

            if (socket && currentChat) {
                socket.emit('typing', {
                    receiver_id: currentChat.id,
                    is_typing: true
                });

                clearTimeout(window.typingTimeout);
                window.typingTimeout = setTimeout(() => {
                    socket.emit('typing', {
                        receiver_id: currentChat.id,
                        is_typing: false
                    });
                }, 2000);
            }
        });
    }

    // Search chat
    const chatSearch = $('#chat-search');
    if (chatSearch) {
        chatSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            $$('.chat-item').forEach(item => {
                const nameEl = item.querySelector('.chat-item-name');
                if (nameEl) {
                    const name = nameEl.textContent.toLowerCase();
                    item.style.display = name.includes(query) ? 'flex' : 'none';
                }
            });
        });
    }
}

async function loadConnections() {
    try {
        const data = await api('/connections');
        connections = data;
        renderChatList();
        renderConnectionsGrid();
    } catch (error) {
        console.error('Failed to load connections:', error);
    }
}

function renderChatList() {
    const list = $('#chat-list');
    if (!list) return;

    list.innerHTML = '';

    if (!connections || connections.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No connections yet. Add users by PIN.</div>';
        return;
    }

    connections.forEach(conn => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.dataset.id = conn.id;
        item.innerHTML = `
            <img src="${conn.avatar || '/uploads/default-avatar.png'}" alt="${conn.display_name || conn.username}">
            <div class="chat-item-info">
                <div class="chat-item-name">${conn.display_name || conn.username}</div>
                <div class="chat-item-preview">Click to chat</div>
            </div>
            <div class="chat-item-meta">
                <div class="chat-item-time">${formatDate(conn.created_at)}</div>
            </div>
        `;

        item.addEventListener('click', () => openChat(conn));
        list.appendChild(item);
    });
}

async function openChat(user) {
    currentChat = user;

    const chatPlaceholder = $('#chat-placeholder');
    const activeChat = $('#active-chat');
    const chatAvatar = $('#chat-avatar');
    const chatName = $('#chat-name');
    const chatStatus = $('#chat-status');
    const chatInputArea = $('#chat-input-area');

    if (chatPlaceholder) chatPlaceholder.classList.add('hidden');
    if (activeChat) {
        activeChat.classList.remove('hidden');
        activeChat.style.display = 'flex';
    }

    if (chatAvatar) chatAvatar.src = user.avatar || '/uploads/default-avatar.png';
    if (chatName) chatName.textContent = user.display_name || user.username;
    if (chatStatus) chatStatus.textContent = user.status || 'offline';

    // Ensure input area is visible
    if (chatInputArea) {
        chatInputArea.style.display = 'flex';
        chatInputArea.style.visibility = 'visible';
    }

    $$('.chat-item').forEach(item => item.classList.remove('active'));
    const activeItem = $(`.chat-item[data-id="${user.id}"]`);
    if (activeItem) activeItem.classList.add('active');

    try {
        const data = await api(`/messages/${user.id}`);
        messages = data || [];
        renderMessages();
        scrollToBottom();

        await api(`/messages/read/${user.id}`, { method: 'POST' }).catch(() => {});
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

function renderMessages() {
    const container = $('#messages-container');
    if (!container) return;
    container.innerHTML = '';

    if (!messages || messages.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No messages yet. Start the conversation!</div>';
        return;
    }

    messages.forEach(msg => {
        appendMessage(msg, false);
    });
}

function appendMessage(message, animate = true) {
    const container = $('#messages-container');
    if (!container) return;

    const isSent = message.sender_id === (currentUser ? currentUser.id : 0);

    const div = document.createElement('div');
    div.className = `message ${isSent ? 'sent' : 'received'}`;
    if (animate) div.style.animation = 'slideUp 0.3s ease';

    let html = `<div class="message-content">${escapeHtml(message.content || '')}</div>`;

    if (message.file_url) {
        const isImage = message.file_type && message.file_type.startsWith('image/');
        if (isImage) {
            html += `
                <div class="message-file">
                    <img src="${message.file_url}" style="max-width: 200px; border-radius: 8px;" alt="${message.file_name || 'image'}">
                </div>
            `;
        } else {
            html += `
                <div class="message-file">
                    <i class="fas fa-file"></i>
                    <div class="message-file-info">
                        <div class="message-file-name">${message.file_name || 'file'}</div>
                        <div class="message-file-type">${message.file_type || 'unknown'}</div>
                    </div>
                    <a href="${message.file_url}" download class="btn-secondary" style="padding: 5px 10px; font-size: 11px;">
                        <i class="fas fa-download"></i>
                    </a>
                </div>
            `;
        }
    }

    html += `<div class="message-time">${formatTime(message.created_at)}</div>`;
    div.innerHTML = html;

    container.appendChild(div);
}

async function sendMessage(content, file = null) {
    if (!currentChat) return;

    console.log('[SEND] Sending message to', currentChat.id);

    const formData = new FormData();
    formData.append('receiver_id', currentChat.id);
    if (content) formData.append('content', content);
    if (file) formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/api/messages/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        const data = await response.json();
        console.log('[SEND] Response:', data);

        if (response.ok && data.data) {
            messages.push(data.data);
            appendMessage(data.data);
            scrollToBottom();

            // Ensure input area stays visible
            const inputArea = $('#chat-input-area');
            if (inputArea) {
                inputArea.style.display = 'flex';
                inputArea.style.visibility = 'visible';
            }
        } else {
            showToast(data.error || 'Failed to send', 'error');
        }
    } catch (error) {
        console.error('[SEND] Error:', error);
        showToast('Failed to send message', 'error');
    }
}

function scrollToBottom() {
    const container = $('#messages-container');
    if (container) container.scrollTop = container.scrollHeight;
}

function updateUserStatus(userId, status) {
    const conn = connections.find(c => c.id === userId);
    if (conn) {
        conn.status = status;
        if (currentChat && currentChat.id === userId) {
            const statusEl = $('#chat-status');
            if (statusEl) statusEl.textContent = status;
        }
    }
}

function updateChatBadge() {
    // Implementation for unread count
}

// ===== FORUM FUNCTIONS =====
function setupForum() {
    const newPostBtn = $('#new-post-btn');
    if (newPostBtn) {
        newPostBtn.addEventListener('click', () => {
            openModal('new-post-modal');
        });
    }

    const postSubmit = $('#post-submit');
    if (postSubmit) {
        postSubmit.addEventListener('click', async () => {
            const titleInput = $('#post-title');
            const contentInput = $('#post-content');
            const categoryInput = $('#post-category');

            if (!titleInput || !contentInput) return;

            const title = titleInput.value.trim();
            const content = contentInput.value.trim();
            const category = categoryInput ? categoryInput.value : 'general';

            if (!title || !content) {
                showToast('Title and content required', 'error');
                return;
            }

            try {
                await api('/forum/post', {
                    method: 'POST',
                    body: { title, content, category }
                });
                showToast('Thread published', 'success');
                closeModal();
                loadForumPosts();
            } catch (error) {
                console.error('Post failed:', error);
            }
        });
    }

    // Category filter
    $$('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadForumPosts(btn.dataset.cat);
        });
    });
}

async function loadForumPosts(category = 'all') {
    try {
        const data = await api(`/forum/posts?category=${category}`);
        renderForumPosts(data);
    } catch (error) {
        console.error('Failed to load posts:', error);
    }
}

function renderForumPosts(posts) {
    const container = $('#forum-posts');
    if (!container) return;
    container.innerHTML = '';

    if (!posts || posts.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fas fa-globe" style="font-size: 48px; margin-bottom: 15px; display: block;"></i><p>No posts yet. Be the first to start a thread!</p></div>';
        return;
    }

    posts.forEach(post => {
        const div = document.createElement('div');
        div.className = `forum-post ${post.is_pinned ? 'pinned' : ''}`;
        div.innerHTML = `
            <div class="post-header">
                <img src="${post.avatar || '/uploads/default-avatar.png'}" class="post-author-img" alt="${post.username}">
                <div class="post-meta">
                    <div class="post-author">${post.display_name || post.username}</div>
                    <div class="post-time">${formatDate(post.created_at)}</div>
                </div>
                <span class="post-category-badge">${post.category || 'general'}</span>
            </div>
            <div class="post-title">${escapeHtml(post.title || 'Untitled')}</div>
            <div class="post-content">${escapeHtml((post.content || '').substring(0, 200))}${(post.content || '').length > 200 ? '...' : ''}</div>
            <div class="post-footer">
                <span class="post-stat"><i class="fas fa-comment"></i> ${post.reply_count || 0} replies</span>
                <span class="post-stat"><i class="fas fa-clock"></i> ${formatTime(post.created_at)}</span>
            </div>
        `;

        div.addEventListener('click', () => openPostDetail(post.id));
        container.appendChild(div);
    });
}

async function openPostDetail(postId) {
    try {
        const data = await api(`/forum/post/${postId}`);

        const detailTitle = $('#detail-title');
        if (detailTitle) detailTitle.textContent = data.post.title || 'Thread';

        let content = `
            <div class="forum-post" style="margin-bottom: 20px;">
                <div class="post-header">
                    <img src="${data.post.avatar || '/uploads/default-avatar.png'}" class="post-author-img" alt="${data.post.username}">
                    <div class="post-meta">
                        <div class="post-author">${data.post.display_name || data.post.username}</div>
                        <div class="post-time">${formatDate(data.post.created_at)}</div>
                    </div>
                </div>
                <div class="post-content">${escapeHtml(data.post.content || '').replace(/\n/g, '<br>')}</div>
            </div>
        `;

        content += '<h3 style="margin: 20px 0; color: var(--accent-green); font-family: var(--font-display);">Replies</h3>';

        if (!data.replies || data.replies.length === 0) {
            content += '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No replies yet</p>';
        } else {
            data.replies.forEach(reply => {
                content += `
                    <div class="forum-post" style="margin-bottom: 10px;">
                        <div class="post-header">
                            <img src="${reply.avatar || '/uploads/default-avatar.png'}" class="post-author-img" alt="${reply.username}">
                            <div class="post-meta">
                                <div class="post-author">${reply.display_name || reply.username}</div>
                                <div class="post-time">${formatDate(reply.created_at)}</div>
                            </div>
                        </div>
                        <div class="post-content">${escapeHtml(reply.content || '')}</div>
                    </div>
                `;
            });
        }

        const postDetailContent = $('#post-detail-content');
        if (postDetailContent) postDetailContent.innerHTML = content;

        const replySubmit = $('#reply-submit');
        if (replySubmit) {
            replySubmit.onclick = async () => {
                const replyContent = $('#reply-content');
                if (!replyContent) return;

                const content = replyContent.value.trim();
                if (!content) return;

                try {
                    await api('/forum/reply', {
                        method: 'POST',
                        body: { post_id: postId, content }
                    });
                    showToast('Reply posted', 'success');
                    replyContent.value = '';
                    openPostDetail(postId);
                } catch (error) {
                    console.error('Reply failed:', error);
                }
            };
        }

        openModal('post-detail-modal');
    } catch (error) {
        console.error('Failed to load post:', error);
    }
}

// ===== CONNECTIONS VIEW =====
function renderConnectionsGrid() {
    const grid = $('#connections-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!connections || connections.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fas fa-network-wired" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                <p>No connections yet. Add users by their PIN.</p>
            </div>
        `;
        return;
    }

    connections.forEach(conn => {
        const card = document.createElement('div');
        card.className = 'connection-card';
        card.innerHTML = `
            <img src="${conn.avatar || '/uploads/default-avatar.png'}" class="connection-avatar" alt="${conn.display_name || conn.username}">
            <div class="connection-name">${conn.display_name || conn.username}</div>
            <div class="connection-username">@${conn.username}</div>
            <div class="connection-pin">${conn.pin_code || 'N/A'}</div>
            <div class="connection-status ${conn.status || 'offline'}">
                <span style="width: 8px; height: 8px; background: ${conn.status === 'online' ? 'var(--accent-green)' : 'var(--accent-red)'}; border-radius: 50%;"></span>
                ${(conn.status || 'offline').toUpperCase()}
            </div>
            <div class="connection-actions">
                <button class="btn-secondary" onclick="openChatById(${conn.id})">
                    <i class="fas fa-comment"></i> Chat
                </button>
                <button class="btn-danger" style="padding: 8px 16px; font-size: 12px;" onclick="removeConnection(${conn.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openChatById(userId) {
    const conn = connections.find(c => c.id === userId);
    if (conn) {
        $$('.nav-item').forEach(i => i.classList.remove('active'));
        const chatNav = $(`.nav-item[data-view="chat"]`);
        if (chatNav) chatNav.classList.add('active');

        $$('.view').forEach(v => v.classList.remove('active'));
        const chatView = $('#chat-view');
        if (chatView) chatView.classList.add('active');

        openChat(conn);
    }
}

async function removeConnection(userId) {
    showToast('Connection removed', 'info');
    loadConnections();
}

// Load pending connection requests
async function loadPendingRequests() {
    try {
        const requests = await api('/connections/pending');
        renderPendingRequests(requests);
    } catch (error) {
        console.error('Failed to load pending requests:', error);
    }
}

function renderPendingRequests(requests) {
    // This will be rendered in the connections view
    const grid = $('#connections-grid');
    if (!grid) return;

    // Clear existing pending section if any
    const existingPending = grid.querySelector('.pending-requests-section');
    if (existingPending) existingPending.remove();

    if (!requests || requests.length === 0) return;

    const pendingSection = document.createElement('div');
    pendingSection.className = 'pending-requests-section';
    pendingSection.style.cssText = 'grid-column: 1/-1; margin-bottom: 20px;';
    pendingSection.innerHTML = `
        <h3 style="color: var(--accent-yellow); font-family: var(--font-display); margin-bottom: 15px;">
            <i class="fas fa-clock"></i> Pending Requests (${requests.length})
        </h3>
        <div class="pending-requests-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
    `;

    const list = pendingSection.querySelector('.pending-requests-list');

    requests.forEach(req => {
        const item = document.createElement('div');
        item.className = 'forum-post';
        item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 15px;';
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${req.avatar || '/uploads/default-avatar.png'}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--accent-yellow);">
                <div>
                    <div style="font-weight: bold; color: var(--text-primary);">${req.display_name || req.username}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">@${req.username} wants to connect</div>
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-small btn-edit" onclick="acceptConnection(${req.id})" style="padding: 8px 16px;">
                    <i class="fas fa-check"></i> Accept
                </button>
                <button class="btn-small btn-delete" onclick="rejectConnection(${req.id})" style="padding: 8px 16px;">
                    <i class="fas fa-times"></i> Reject
                </button>
            </div>
        `;
        list.appendChild(item);
    });

    grid.insertBefore(pendingSection, grid.firstChild);
}

async function acceptConnection(connectionId) {
    try {
        await api('/connections/accept', {
            method: 'POST',
            body: { connection_id: connectionId }
        });
        showToast('Connection accepted', 'success');
        loadPendingRequests();
        loadConnections();
    } catch (error) {
        console.error('Accept failed:', error);
    }
}

async function rejectConnection(connectionId) {
    try {
        await api('/connections/reject', {
            method: 'POST',
            body: { connection_id: connectionId }
        });
        showToast('Connection rejected', 'info');
        loadPendingRequests();
    } catch (error) {
        console.error('Reject failed:', error);
    }
}

function updateConnectionBadge() {
    // Update badge on connections nav item
    const badge = $('#connections-badge');
    if (badge) {
        api('/connections/pending').then(reqs => {
            badge.textContent = reqs.length;
            badge.style.display = reqs.length > 0 ? 'flex' : 'none';
        }).catch(() => {});
    }
}

// ===== PROFILE FUNCTIONS =====
function updateProfileView() {
    if (!currentUser) return;

    const profileName = $('#profile-name');
    const profileUsername = $('#profile-username');
    const profilePin = $('#profile-pin');
    const profileAvatar = $('#profile-avatar');
    const profileDisplayName = $('#profile-display-name');
    const profileBio = $('#profile-bio');
    const profileStatus = $('#profile-status');

    if (profileName) profileName.textContent = currentUser.display_name || currentUser.username;
    if (profileUsername) profileUsername.textContent = `@${currentUser.username}`;
    if (profilePin) profilePin.textContent = `PIN: ${currentUser.pin_code || 'N/A'}`;
    if (profileAvatar) profileAvatar.src = currentUser.avatar || '/uploads/default-avatar.png';
    if (profileDisplayName) profileDisplayName.value = currentUser.display_name || '';
    if (profileBio) profileBio.value = currentUser.bio || '';
    if (profileStatus) profileStatus.value = currentUser.status_message || '';
}

function setupProfile() {
    const changeAvatarBtn = $('#change-avatar-btn');
    const avatarInput = $('#avatar-input');

    if (changeAvatarBtn && avatarInput) {
        changeAvatarBtn.addEventListener('click', () => avatarInput.click());

        avatarInput.addEventListener('change', async () => {
            const file = avatarInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('avatar', file);
            formData.append('display_name', $('#profile-display-name') ? $('#profile-display-name').value : '');
            formData.append('bio', $('#profile-bio') ? $('#profile-bio').value : '');
            formData.append('status_message', $('#profile-status') ? $('#profile-status').value : '');

            try {
                const response = await fetch(`${API_BASE}/api/profile/update`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` },
                    body: formData
                });

                if (response.ok) {
                    showToast('Avatar updated', 'success');
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const profileAvatar = $('#profile-avatar');
                        const sidebarAvatar = $('#sidebar-avatar');
                        if (profileAvatar) profileAvatar.src = e.target.result;
                        if (sidebarAvatar) sidebarAvatar.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            } catch (error) {
                showToast('Update failed', 'error');
            }
        });
    }

    const saveProfileBtn = $('#save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            const formData = new FormData();
            const displayName = $('#profile-display-name');
            const bio = $('#profile-bio');
            const status = $('#profile-status');

            formData.append('display_name', displayName ? displayName.value : '');
            formData.append('bio', bio ? bio.value : '');
            formData.append('status_message', status ? status.value : '');

            try {
                const response = await fetch(`${API_BASE}/api/profile/update`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` },
                    body: formData
                });

                if (response.ok) {
                    showToast('Profile updated', 'success');
                    if (currentUser && displayName) {
                        currentUser.display_name = displayName.value;
                        const sidebarName = $('#sidebar-name');
                        if (sidebarName) sidebarName.textContent = currentUser.display_name;
                    }
                }
            } catch (error) {
                showToast('Update failed', 'error');
            }
        });
    }
}

// ===== SETTINGS FUNCTIONS =====
function setupSettings() {
    const changePasswordBtn = $('#change-password-btn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            openModal('password-modal');
        });
    }

    const passwordSubmit = $('#password-submit');
    if (passwordSubmit) {
        passwordSubmit.addEventListener('click', async () => {
            const current = $('#current-password');
            const newPass = $('#new-password');
            const confirm = $('#confirm-new-password');

            if (!current || !newPass || !confirm) return;

            if (newPass.value !== confirm.value) {
                showToast('New passwords do not match', 'error');
                return;
            }

            try {
                await api('/change-password', {
                    method: 'POST',
                    body: {
                        current_password: current.value,
                        new_password: newPass.value
                    }
                });
                showToast('Password updated successfully', 'success');
                closeModal();
                current.value = '';
                newPass.value = '';
                confirm.value = '';
            } catch (error) {
                console.error('Password change failed:', error);
            }
        });
    }

    const clearDataBtn = $('#clear-data-btn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            localStorage.clear();
            showToast('Local data cleared', 'info');
        });
    }
}

// ===== MODAL FUNCTIONS =====
function setupModals() {
    $$('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    const modalOverlay = $('#modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }
}

function openModal(modalId) {
    console.log('[UI] Opening modal:', modalId);

    const modalOverlay = document.getElementById('modal-overlay');
    const modal = document.getElementById(modalId);

    if (!modalOverlay) {
        console.error('[UI] modal-overlay not found!');
        return;
    }
    if (!modal) {
        console.error('[UI] Modal not found:', modalId);
        return;
    }

    // Remove hidden class
    modalOverlay.classList.remove('hidden');
    modal.classList.remove('hidden');

    // Force display styles
    modalOverlay.style.display = 'flex';
    modal.style.display = 'block';

    console.log('[UI] Modal opened successfully');
}

function closeModal() {
    const modalOverlay = document.getElementById('modal-overlay');

    if (modalOverlay) {
        modalOverlay.classList.add('hidden');
        modalOverlay.style.display = '';
    }

    document.querySelectorAll('.modal').forEach(m => {
        m.classList.add('hidden');
        m.style.display = '';
    });

    document.querySelectorAll('.modal input, .modal textarea').forEach(input => {
        input.value = '';
    });
}

// ===== UTILITY =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== SERVICE WORKER (PWA) =====
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/js/sw.js').catch(err => {
        console.log('[SW] Registration failed:', err.message);
    });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('[INIT] DarkNet Chat initializing...');

    // Check for saved session
    const savedToken = localStorage.getItem('darknet_token');
    const savedUser = localStorage.getItem('darknet_user');

    console.log('[INIT] Saved token:', savedToken ? 'YES' : 'NO');
    console.log('[INIT] Saved user:', savedUser ? 'YES' : 'NO');

    if (savedToken && savedUser) {
        try {
            authToken = savedToken;
            currentUser = JSON.parse(savedUser);
            console.log('[INIT] Restoring session for:', currentUser.username);
            initApp();
        } catch (err) {
            console.error('[INIT] Failed to restore session:', err);
            localStorage.removeItem('darknet_token');
            localStorage.removeItem('darknet_user');
            initAuth();
        }
    } else {
        console.log('[INIT] No saved session, showing auth screen');
        initAuth();
    }
});


// Debug helper - can be called from browser console
window.debugDarkNet = {
    openPinModal: function() {
        console.log('[DEBUG] Manually opening PIN modal');
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('new-chat-modal');

        if (!overlay) {
            console.error('[DEBUG] modal-overlay not found!');
            return;
        }
        if (!modal) {
            console.error('[DEBUG] new-chat-modal not found!');
            return;
        }

        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
        console.log('[DEBUG] Modal should be visible now');
    },

    checkElements: function() {
        console.log('[DEBUG] Checking critical elements:');
        const elements = [
            'modal-overlay', 'new-chat-modal', 'connect-pin', 
            'connect-submit', 'add-connection-btn', 'new-chat-btn'
        ];
        elements.forEach(id => {
            const el = document.getElementById(id);
            console.log(`  ${id}: ${el ? 'FOUND' : 'NOT FOUND'}`);
        });
    },

    testConnect: function(pin) {
        console.log('[DEBUG] Testing connect with PIN:', pin);
        fetch('/api/user/pin/' + pin, {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('darknet_token') }
        })
        .then(r => r.json())
        .then(data => console.log('[DEBUG] User search result:', data))
        .catch(err => console.error('[DEBUG] Error:', err));
    }
};

console.log('[DEBUG] Debug helpers loaded. Try: debugDarkNet.openPinModal()');
