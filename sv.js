const express = require("express");
const path = require("path");
const mysql = require('mysql2');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const dbase = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'login_db'
});

dbase.connect(err => {
    if (err) {
        console.log("DB connection error:", err);
        return;
    }
    console.log("MySQL connected!");
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    dbase.query(
        "SELECT * FROM users WHERE username = ? AND password = ?",
        [username, password],
        (err, results) => {
            if (err) {
                console.log("Mysql login-page error?");
                return res.send(`<script>alert("Database error!"); window.location.href = "/login";</script>`)};

            if (results.length === 0) {
                console.log("Unsuccesful login attempt. ", req.body);
                return res.send(`<script>alert("Username or password is incorrect."); window.location.href = "/login";</script>`);
            }
            console.log("Succesful login attempt. ", req.body);

            res.redirect("/dashboard");
        }
    );
});


// 1. Sign Up sayfasını gösterme rotası (GET)
app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "signup.html"));
});

// 2. Sign Up formunu işleme rotası (POST)
app.post("/signup", (req, res) => {
    const { username, password } = req.body;

    // Basit doğrulama: Alanlar boş mu?
    if (!username || !password) {
         // Gerçek projede daha şık bir hata gösterimi yapılır
        return res.send("Lütfen kullanıcı adı ve şifre giriniz.");
    }

    // ADIM A: Önce bu kullanıcı adı zaten var mı diye kontrol et
    dbase.query(
        "SELECT username FROM users WHERE username = ?",
        [username],
        (err, results) => {
            if (err) {
                console.error("Kontrol hatası:", err);
                return res.send("Veritabanı hatası oluştu.");
            }

            if (results.length > 0) {
                // Eğer sonuç varsa, bu kullanıcı adı alınmış demektir.
                console.log(`Username: '${username}' already exists.`);
                return res.send(`'${username}' kullanıcı adı zaten kullanımda!`);
            } else {
                // ADIM B: Kullanıcı adı müsait, şimdi kaydedebiliriz.
                // NOT: Şifreleri yine açık metin (plaintext) olarak kaydediyoruz. 
                // Öğrenme aşaması için bu OK, ama gerçek projede ASLA yapma.
                dbase.query(
                    "INSERT INTO users (username, password) VALUES (?, ?)",
                    [username, password],
                    (insertErr, insertResult) => {
                        if (insertErr) {
                             console.error("Kayıt hatası:", insertErr);
                             return res.send("Kayıt sırasında bir hata oluştu.");
                        }
                        
                        console.log(`Yeni kullanıcı kaydedildi: '${username}'`);
                        // Kayıt başarılı! Kullanıcıyı giriş sayfasına yönlendir.
                        res.redirect("/login"); 
                    }
                );
            }
        }
    );
});


app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(4444, () => console.log("Server running at http://localhost:4444"));