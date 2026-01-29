const express = require("express");
const path = require("path");
const mysql = require('mysql2');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const bcrypt = require('bcrypt');
const saltRounds = 10;
const app = express();

const server = http.createServer(app); // Express'i HTTP server'a bağla
const io = new Server(server); // Socket.io'yu başlat


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// --- SESSION AYARLARI ---
app.use(session({
    secret: process.env.SESSION_SECRET, // .env dosyasındaki gizli anahtarı kullanır
    resave: true,                       // Oturumu her istekte yeniler, bağlantı kopmalarını önler
    saveUninitialized: false,           // Sadece giriş yapmış kullanıcılar için oturum oluşturur (Daha güvenli)
    cookie: { 
        secure: false,                  // HTTP (Localhost) için false, HTTPS'ye geçince Render bunu yönetecek zaten
        maxAge: 1000 * 60 * 60 * 24     // Oturumun ömrü 1 gün
    }
}));

const dbase = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306, //both local and hosting
    // EĞER host localhost değilse SSL kullan, localhost ise SSL'i kapat
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

// --- SERVER.JS İÇİNDEKİ SOCKET.IO KISMI ---

let activeUsers = {}; // Online kullanıcılar
// (Opsiyonel) Sesli kanaldaki kullanıcıları da tutabilirsin ama PeerJS bunu p2p hallediyor.

io.on('connection', (socket) => {

    // 1. KULLANICI GİRİŞİ (TEXT CHAT İÇİN)
    socket.on('user_joined', (username) => {
        console.log(`A user connected`, username, 'Socket id:', socket.id);
        activeUsers[socket.id] = username;
        io.emit('update_user_list', Object.values(activeUsers));
    });

    // 2. TEXT MESAJLAŞMA
    socket.on('chat_message', (data) => {
        io.emit('new_message', data);
    });

    // -- SESLİ SOHBET OLAYLARI (BURASI KRİTİK) --

    // 3. BİRİSİ SESE GİRDİĞİNDE
    socket.on('join-voice', (data) => {
        // Bu mesajı gönderen hariç ODADAKİ HERKESE duyur
        socket.broadcast.emit('user-joined-voice', data);
        console.log(`${data.username} joined Voice Channel`);

        socket.broadcast.emit('user-voice-status', { 
        username: data.username, 
        inVoice: true 
        });
    });

    // 4. KULLANICI AYRILDIĞINDA (HEM CHAT HEM SES)
    socket.on('disconnect', () => {
        if (activeUsers[socket.id]) {
            const username = activeUsers[socket.id];
            
            // Önce sesten ayrıldığını herkese duyur (Böylece "IN VOICE" yazısı silinir)
            socket.broadcast.emit('user-voice-status', { 
                username: username, 
                inVoice: false 
            });

            console.log(`${username} left`);
            delete activeUsers[socket.id];
            io.emit('update_user_list', Object.values(activeUsers));
        }
    });

    // Kullanıcı sesten ayrıldığında
    socket.on('leave-voice', (data) => {
        socket.broadcast.emit('user-voice-status', { 
            username: data.username, 
            inVoice: false 
        });
    });

});

app.get("/login", (req,res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req,res) => {
    const {username, password} = req.body;

    console.log(`Login attempt: ${username}:${password}`);

    if (!username || !password) {
        return res.json({ success: false, message: "Username or password is missing." });
    }

    dbase.query(
        "SELECT * FROM users WHERE BINARY username = ?",
        [username],
        (err, results) => {
            if(err){ 
                console.log("Database login connection error.");
                return res.json({ success: false, message: "Database error." });
            }

            if(results.length > 0){
                const user = results[0];

                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if (err) {
                        console.log("Bcrypt error:", err);
                        return res.status(500).json({ success: false, message: "Password control error." });
                    }

                    if (isMatch){
                        req.session.user = username;

                        req.session.save((err) => {
                            if (err) return console.log("Session save error:", err);
                            console.log("SUCCESSFUL");
                            res.json({ success: true, redirectUrl: "/dashboard" });
                            return;
                        });
                    }

                    else{
                        console.log(`Username or password is incorrect.`);
                        res.json({ success: false, message: "Username or password is incorrect!" });
                        return;
                    }
                });
            }
            else{
                console.log(`User not found`);
                res.json({ success: false, message: "Username or password is incorrect!" });
                return;
            }
        }
    );
});



// 1. Sign Up sayfasını gösterme rotası (GET)
app.get("/signup", (req,res) => {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// 2. Sign Up formunu işleme rotası (POST)
app.post("/signup", (req,res) => {
    const {username, password} = req.body;
    if(!username || !password){
        res.json({ success: false, message: "Enter username and password." });
        return;
    }

    dbase.query(
        "SELECT username FROM users WHERE username = ?",
        [username],
        (err, results) => {
            if (err) {
                console.log("Database signup error:", err);
                return res.json({ success: false, message: "A database error occurred." });
            }

            if(results.length > 0){
                console.log(`Username: '${username}' is already exists. Use another one.`);
                res.json({ success: false, message: `Username '${username}' already exists. User another one.` });
                return;
            }

            bcrypt.hash(password, saltRounds, (err, hashedPassword) => {

            if (err) {
                    console.log("Hashing error:", err);
                    return res.json({ success: false, message: "Error securing password." });
            }

            dbase.query(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                [username, hashedPassword],
                (err, results) => {
                    if (err) {
                            console.log("Database signup insert error:", err);
                            return res.json({ success: false, message: "Error creating user." });
                    }
                    
                    console.log(`username:'${username}', password: '${password}' has been created. You can login now.`);
                    res.json({ success: true, message: `username:'${username}', password: '${password}' has been created. You can login now.` });
                    return;
                }
            );

            });
        }
    );
});

app.get("/api/userinfo", (req,res) => {
    if(req.session.user){
        res.json({ username: req.session.user });
    }
    else{
        res.status(401).json({ error: "Couldn't be logged in." });
    }
});

app.get("/dashboard", (req, res) => {
    if(!req.session.user){
        console.log("Unpermitted dashboard attempt?");
        return res.redirect("/login");
    }

    res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/logout", (req,res) => {
    req.session.destroy();
    res.redirect("/");
    return;
});

app.get("/chat", (req, res) => {
    if(req.session.user) res.sendFile(__dirname + "/chat.html");
    else res.redirect("/login");
});

const PORT = process.env.PORT || 4444;

server.listen(PORT, () => {
    console.log(`Server + Chat running at port: ${PORT}`);
    console.log(`Local erişim: http://localhost:${PORT}`);
});