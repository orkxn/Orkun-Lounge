const express = require("express");
const path = require("path");
const mysql = require('mysql2');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');

// Security packages
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');

require('dotenv').config();

const bcrypt = require('bcrypt');
const saltRounds = 10;
const app = express();

// Trust proxy for Render.com and other reverse proxies (needed for rate limiting)
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server);

const peerServer = ExpressPeerServer(server, {
    debug: process.env.NODE_ENV !== 'production',
    path: '/'
});

app.use('/peerjs', peerServer);

// Security: Helmet adds various HTTP headers for security
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", "wss:", "ws:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// Rate limiting for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { success: false, message: "Too many attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(generalLimiter);

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10kb' })); // Limit JSON body size
app.use(express.static("public"));

// Enhanced session security
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
    secret: process.env.SESSION_SECRET || "gizli_anahtar",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction, // HTTPS only in production
        httpOnly: true, // Prevent XSS access to cookies
        sameSite: 'lax', // CSRF protection
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

const dbase = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    ssl: (process.env.DB_HOST && process.env.DB_HOST !== 'localhost')
        ? { rejectUnauthorized: false }
        : false,
    connectTimeout: 60000
});

dbase.connect(err => {
    if (err) {
        console.log("DB connection error:", err);
        return;
    }
    console.log("MySQL connected!");
});


function broadcastUserList() {
    // 1. Kullanıcı Listesini Gönder
    const userList = [...new Set(Object.values(activeUsers))];
    io.emit('update_user_list', userList);

    io.emit('current_voice_users', Array.from(voiceUsers));
}

let activeUsers = {};
let voiceUsers = new Map(); // Map username -> peerId
let userStatus = {};  // Track user status (online, idle, dnd, invisible)
let typingUsers = {}; // Track who is typing
let screenShareUser = null; // Track who is screen sharing { username, peerId }

io.on('connection', (socket) => {

    socket.on('user_joined', (username) => {
        Object.keys(activeUsers).forEach((socketId) => {
            if (activeUsers[socketId] === username) {
                delete activeUsers[socketId];
            }
        });

        console.log(`A user connected: ${username} (Socket ID: ${socket.id})`);
        activeUsers[socket.id] = username;

        // Set default status to online
        if (!userStatus[username]) {
            userStatus[username] = 'online';
        }

        socket.emit('current_voice_users', Array.from(voiceUsers));

        // Send current user statuses to the new user
        socket.emit('all_user_status', userStatus);

        broadcastUserList();

        // Broadcast this user's status to everyone
        io.emit('user_status_update', { username, status: userStatus[username] });
    });

    socket.on('chat_message', (data) => {
        const username = activeUsers[socket.id];
        if (!username) return;

        // Save message to database first to get the real ID
        dbase.query(
            "SELECT id FROM users WHERE username = ?",
            [username],
            (err, userResults) => {
                if (err || userResults.length === 0) {
                    // Fallback: emit without saving
                    io.emit('new_message', {
                        ...data,
                        id: Date.now(),
                        timestamp: new Date().toISOString()
                    });
                    return;
                }

                dbase.query(
                    "INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)",
                    [userResults[0].id, username, data.text],
                    (err, insertResult) => {
                        // Use insertId from database as the message ID
                        const messageData = {
                            ...data,
                            id: insertResult ? insertResult.insertId : Date.now(),
                            timestamp: new Date().toISOString()
                        };

                        if (err) console.error("Error saving message:", err);

                        io.emit('new_message', messageData);
                    }
                );
            }
        );
    });

    // Typing indicators
    socket.on('typing_start', () => {
        const username = activeUsers[socket.id];
        if (username) {
            typingUsers[username] = Date.now();
            socket.broadcast.emit('user_typing', { username, isTyping: true });
        }
    });

    socket.on('typing_stop', () => {
        const username = activeUsers[socket.id];
        if (username) {
            delete typingUsers[username];
            socket.broadcast.emit('user_typing', { username, isTyping: false });
        }
    });

    // User status change
    socket.on('status_change', (status) => {
        const username = activeUsers[socket.id];
        if (username && ['online', 'idle', 'dnd', 'invisible'].includes(status)) {
            userStatus[username] = status;
            io.emit('user_status_update', { username, status });

            // Save to database
            dbase.query(
                "UPDATE users SET status = ? WHERE username = ?",
                [status, username],
                (err) => {
                    if (err) console.error("Error updating status:", err);
                }
            );
        }
    });

    // Voice speaking indicator
    socket.on('voice_speaking', (isSpeaking) => {
        const username = activeUsers[socket.id];
        if (username) {
            socket.broadcast.emit('user_speaking', { username, isSpeaking });
        }
    });

    // Message reactions - toggle (add/remove)
    socket.on('toggle_reaction', (data) => {
        const username = activeUsers[socket.id];
        if (username) {
            io.emit('reaction_toggled', {
                messageId: data.messageId,
                emoji: data.emoji,
                username
            });
        }
    });

    // Delete message (own messages or admin can delete any)
    socket.on('delete_message', (data) => {
        const username = activeUsers[socket.id];
        if (!username) return;

        // Check if user is admin or owns the message
        const isAdmin = username.toLowerCase() === 'admin';

        if (isAdmin || data.messageOwner === username) {
            // Delete from database
            dbase.query(
                "DELETE FROM messages WHERE id = ?",
                [data.messageId],
                (err) => {
                    if (err) {
                        console.error("Error deleting message:", err);
                    } else {
                        io.emit('message_deleted', { messageId: data.messageId });
                    }
                }
            );
        }
    });

    // Admin: Delete any message, kick users, etc
    socket.on('admin_action', (data) => {
        const username = activeUsers[socket.id];
        if (!username || username.toLowerCase() !== 'admin') return;

        if (data.action === 'clear_chat') {
            dbase.query("DELETE FROM messages", (err) => {
                if (!err) {
                    io.emit('chat_cleared');
                }
            });
        }
    });

    // -- SESLİ SOHBET OLAYLARI --
    socket.on('join-voice', (data) => {
        voiceUsers.set(data.username, data.peerId); // Store username -> peerId
        socket.broadcast.emit('user-joined-voice', data);
        console.log(`${data.username} joined Voice Channel with peerId: ${data.peerId}`);

        socket.broadcast.emit('user-voice-status', {
            username: data.username,
            inVoice: true
        });

        // Send current screen share status to the joining user
        if (screenShareUser && screenShareUser.username !== data.username) {
            socket.emit('current-screenshare', {
                username: screenShareUser.username,
                peerId: screenShareUser.peerId
            });

            // Also tell the sharer to send their stream to this new user
            socket.broadcast.emit('new-viewer-for-screenshare', {
                viewerPeerId: data.peerId,
                viewerUsername: data.username
            });
        }
    });

    socket.on('disconnect', () => {
        if (activeUsers[socket.id]) {
            const username = activeUsers[socket.id];

            // Clean up typing status
            delete typingUsers[username];
            socket.broadcast.emit('user_typing', { username, isTyping: false });

            if (voiceUsers.has(username)) {
                voiceUsers.delete(username);
            }

            socket.broadcast.emit('user-voice-status', {
                username: username,
                inVoice: false
            });

            // Stop screen share if disconnecting user was sharing
            if (screenShareUser && screenShareUser.username === username) {
                screenShareUser = null;
                socket.broadcast.emit('user-stopped-screenshare', {
                    username: username
                });
            }

            console.log(`${username} left (Disconnected)`);
            delete activeUsers[socket.id];

            broadcastUserList();
        }
    });

    socket.on('leave-voice', (data) => {
        voiceUsers.delete(data.username);
        socket.broadcast.emit('user-voice-status', {
            username: data.username,
            inVoice: false
        });

        // Stop screen share if the leaving user was sharing
        if (screenShareUser && screenShareUser.username === data.username) {
            screenShareUser = null;
            socket.broadcast.emit('user-stopped-screenshare', {
                username: data.username
            });
        }
    });

    // --- SCREEN SHARE EVENTS ---
    socket.on('start-screenshare', (data) => {
        const username = activeUsers[socket.id];
        if (!username || !voiceUsers.has(username)) return;

        // Only one person can share at a time
        if (screenShareUser && screenShareUser.username !== username) {
            socket.emit('screenshare-denied', { reason: 'Someone else is already sharing' });
            return;
        }

        screenShareUser = { username: username, peerId: data.peerId };

        // Send list of voice user peerIds to the sharer so they can broadcast
        const otherVoiceUserPeerIds = [];
        voiceUsers.forEach((peerId, voiceUsername) => {
            if (voiceUsername !== username) {
                otherVoiceUserPeerIds.push(peerId);
            }
        });

        socket.emit('voice-users-for-screenshare', {
            peerIds: otherVoiceUserPeerIds
        });

        socket.broadcast.emit('user-started-screenshare', {
            peerId: data.peerId,
            username: username
        });
        console.log(`${username} started screen sharing, broadcasting to ${otherVoiceUserPeerIds.length} users`);
    });

    socket.on('stop-screenshare', (data) => {
        const username = activeUsers[socket.id];
        if (screenShareUser && screenShareUser.username === username) {
            screenShareUser = null;
            socket.broadcast.emit('user-stopped-screenshare', {
                username: username
            });
            console.log(`${username} stopped screen sharing`);
        }
    });

    // Forward screen share request to the sharer (workaround for PeerJS metadata issue)
    socket.on('screenshare-request', (data) => {
        socket.broadcast.emit('screenshare-request-notify', {
            requesterPeerId: data.requesterPeerId,
            sharerPeerId: data.sharerPeerId
        });
    });
});

// --- ROTALAR (LOGIN, SIGNUP, DASHBOARD) ---

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", authLimiter, (req, res) => {
    const { username, password } = req.body;

    // Input validation
    if (!username || !password) {
        return res.json({ success: false, message: "Username or password is missing." });
    }

    // Sanitize username
    const cleanUsername = validator.trim(username);
    if (!validator.isLength(cleanUsername, { min: 3, max: 30 })) {
        return res.json({ success: false, message: "Invalid username format." });
    }

    dbase.query(
        "SELECT * FROM users WHERE BINARY username = ?",
        [cleanUsername],
        (err, results) => {
            if (err) {
                console.log("Database login error:", err);
                return res.json({ success: false, message: "Database error." });
            }

            if (results.length > 0) {
                const user = results[0];
                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if (err) return res.status(500).json({ success: false, message: "Error." });
                    if (isMatch) {
                        req.session.user = cleanUsername;
                        req.session.save((err) => {
                            if (err) return console.log("Session save error:", err);
                            res.json({ success: true, redirectUrl: "/dashboard" });
                        });
                    } else {
                        res.json({ success: false, message: "Username or password is incorrect!" });
                    }
                });
            } else {
                res.json({ success: false, message: "Username or password is incorrect!" });
            }
        }
    );
});

app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.post("/signup", authLimiter, (req, res) => {
    const { username, password } = req.body;

    // Input validation
    if (!username || !password) {
        return res.json({ success: false, message: "Enter username and password." });
    }

    // Sanitize and validate username
    const cleanUsername = validator.trim(username);
    if (!validator.isAlphanumeric(cleanUsername) || !validator.isLength(cleanUsername, { min: 3, max: 30 })) {
        return res.json({ success: false, message: "Username must be 3-30 alphanumeric characters." });
    }

    // Password requirements
    if (!validator.isLength(password, { min: 8 })) {
        return res.json({ success: false, message: "Password must be at least 8 characters." });
    }

    dbase.query("SELECT username FROM users WHERE username = ?", [cleanUsername], (err, results) => {
        if (err) return res.json({ success: false, message: "Database error." });
        if (results.length > 0) {
            // Don't echo back username (prevent XSS reflection)
            return res.json({ success: false, message: "Username already exists." });
        }

        bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
            if (err) return res.json({ success: false, message: "Error securing password." });
            dbase.query("INSERT INTO users (username, password) VALUES (?, ?)", [cleanUsername, hashedPassword], (err, results) => {
                if (err) return res.json({ success: false, message: "Error creating user." });
                res.json({ success: true, message: "User created! Login now." });
            });
        });
    });
});

// API endpoint to get recent messages
app.get("/api/messages", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not logged in." });
    }

    dbase.query(
        "SELECT id, username, content, created_at FROM messages ORDER BY created_at DESC LIMIT 50",
        (err, results) => {
            if (err) {
                console.error("Error fetching messages:", err);
                return res.status(500).json({ error: "Database error" });
            }
            // Reverse to show oldest first
            res.json(results.reverse());
        }
    );
});

app.get("/api/userinfo", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not logged in." });
    }

    dbase.query(
        "SELECT username, avatar_url FROM users WHERE username = ?",
        [req.session.user],
        (err, results) => {
            if (err || results.length === 0) {
                return res.json({
                    username: req.session.user,
                    isAdmin: req.session.user.toLowerCase() === 'admin',
                    avatar: null
                });
            }
            res.json({
                username: results[0].username,
                isAdmin: results[0].username.toLowerCase() === 'admin',
                avatar: results[0].avatar_url
            });
        }
    );
});

// Update profile picture
app.post("/api/avatar", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not logged in." });
    }

    const { avatarUrl } = req.body;

    // Validate URL (basic check)
    if (!avatarUrl || (!avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://'))) {
        return res.status(400).json({ error: "Invalid avatar URL." });
    }

    dbase.query(
        "UPDATE users SET avatar_url = ? WHERE username = ?",
        [avatarUrl, req.session.user],
        (err) => {
            if (err) {
                console.error("Error updating avatar:", err);
                return res.status(500).json({ error: "Database error." });
            }
            res.json({ success: true, avatarUrl });
        }
    );
});

// Get all users with avatars (for chat)
app.get("/api/users", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not logged in." });
    }

    dbase.query(
        "SELECT username, avatar_url FROM users",
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: "Database error." });
            }
            const usersMap = {};
            results.forEach(u => {
                usersMap[u.username] = { avatar: u.avatar_url };
            });
            res.json(usersMap);
        }
    );
});

app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

app.get("/chat", (req, res) => {
    if (req.session.user) res.sendFile(__dirname + "/chat.html");
    else res.redirect("/login");
});

const PORT = process.env.PORT || 4444;

server.listen(PORT, () => {
    console.log(`Server + Chat running at port: ${PORT}`);
    console.log(`Server + Chat running at: http://localhost:${PORT}`);
});