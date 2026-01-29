const express = require("express");
const path = require("path");
const mysql = require('mysql2');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
// +++ 1. PEER KÜTÜPHANESİNİ ÇAĞIRDIK +++
const { ExpressPeerServer } = require('peer'); 
// +++++++++++++++++++++++++++++++++++++++

require('dotenv').config();

const bcrypt = require('bcrypt');
const saltRounds = 10;
const app = express();

const server = http.createServer(app); 
const io = new Server(server); 

// +++ 2. SES SUNUCUSUNU EXPRESS İÇİNE GÖMDÜK +++
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});

app.use('/peerjs', peerServer);
// ++++++++++++++++++++++++++++++++++++++++++++++

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// --- SESSION AYARLARI ---
app.use(session({
    secret: process.env.SESSION_SECRET || "gizli_anahtar", 
    resave: true,                       
    saveUninitialized: false,           
    cookie: { 
        secure: false,                  
        maxAge: 1000 * 60 * 60 * 24     
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
let voiceUsers = new Set();

io.on('connection', (socket) => {

    socket.on('user_joined', (username) => {
        Object.keys(activeUsers).forEach((socketId) => {
            if (activeUsers[socketId] === username) {
                delete activeUsers[socketId];
            }
        });

        console.log(`A user connected: ${username} (Socket ID: ${socket.id})`);
        activeUsers[socket.id] = username;
        

        socket.emit('current_voice_users', Array.from(voiceUsers));

        broadcastUserList();
    });

    socket.on('chat_message', (data) => {
        io.emit('new_message', data);
    });

    // -- SESLİ SOHBET OLAYLARI --
    socket.on('join-voice', (data) => {
        voiceUsers.add(data.username);
        socket.broadcast.emit('user-joined-voice', data);
        console.log(`${data.username} joined Voice Channel`);

        socket.broadcast.emit('user-voice-status', { 
            username: data.username, 
            inVoice: true 
        });
    });

    socket.on('disconnect', () => {
        if (activeUsers[socket.id]) {
            const username = activeUsers[socket.id];
            
            if (voiceUsers.has(username)) {    
                voiceUsers.delete(username);   
            }

            socket.broadcast.emit('user-voice-status', { 
                username: username, 
                inVoice: false 
            });

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
    });
});

// --- ROTALAR (LOGIN, SIGNUP, DASHBOARD) ---

app.get("/login", (req,res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req,res) => {
    const {username, password} = req.body;

    if (!username || !password) {
        return res.json({ success: false, message: "Username or password is missing." });
    }

    dbase.query(
        "SELECT * FROM users WHERE BINARY username = ?",
        [username],
        (err, results) => {
            if(err){ 
                console.log("Database login error:", err);
                return res.json({ success: false, message: "Database error." });
            }

            if(results.length > 0){
                const user = results[0];
                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if (err) return res.status(500).json({ success: false, message: "Error." });
                    if (isMatch){
                        req.session.user = username;
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

app.get("/signup", (req,res) => {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.post("/signup", (req,res) => {
    const {username, password} = req.body;
    if(!username || !password){
        return res.json({ success: false, message: "Enter username and password." });
    }

    dbase.query("SELECT username FROM users WHERE username = ?", [username], (err, results) => {
        if (err) return res.json({ success: false, message: "Database error." });
        if(results.length > 0){
            return res.json({ success: false, message: `Username '${username}' already exists.` });
        }

        bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
            if (err) return res.json({ success: false, message: "Error securing password." });
            dbase.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], (err, results) => {
                if (err) return res.json({ success: false, message: "Error creating user." });
                res.json({ success: true, message: "User created! Login now." });
            });
        });
    });
});

app.get("/api/userinfo", (req,res) => {
    if(req.session.user) res.json({ username: req.session.user });
    else res.status(401).json({ error: "Not logged in." });
});

app.get("/dashboard", (req, res) => {
    if(!req.session.user) return res.redirect("/login");
    res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/logout", (req,res) => {
    req.session.destroy();
    res.redirect("/");
});

app.get("/chat", (req, res) => {
    if(req.session.user) res.sendFile(__dirname + "/chat.html");
    else res.redirect("/login");
});

const PORT = process.env.PORT || 4444;

server.listen(PORT, () => {
    console.log(`Server + Chat running at port: ${PORT}`);
    console.log(`Server + Chat running at: http://localhost:${PORT}`);
});