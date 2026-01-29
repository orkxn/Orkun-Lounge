const { app, BrowserWindow, shell } = require('electron');
const { autoUpdater } = require("electron-updater");
const path = require('path');
const log = require("electron-log");

// 1. Loglama Ayarları (Hata takibi için)
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

function createWindow() {
    // 2. Pencere Ayarları
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Orkun Lounge",
        // icon: path.join(__dirname, 'public/favicon.ico'), 
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // Ses ve Video İzinlerini Otomatik Onayla
            permissionRequestHandler: (webContents, permission, callback) => {
                const allowedPermissions = ['media', 'audioCapture', 'videoCapture'];
                if (allowedPermissions.includes(permission)) {
                    callback(true); 
                } else {
                    callback(false);
                }
            }
        }
    });

    // 3. Menü Çubuğunu Gizle
    win.setMenuBarVisibility(false);

    // 4. Bağlantı Adresi
    const appUrl = 'https://orkunlounge.onrender.com'; 
    win.loadURL(appUrl);

    // Dış linkleri varsayılan tarayıcıda aç
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    
    // Pencere açılıp içerik göründüğünde güncelleme kontrolü yap
    win.once('ready-to-show', () => {
        // Hem kontrol eder hem de kullanıcıya bildirim gösterir (Windows notification)
        autoUpdater.checkForUpdatesAndNotify();
    });
}


// Güncelleme bulundu
autoUpdater.on('update-available', () => {
    log.info('Yeni bir güncelleme bulundu, indiriliyor...');
});

// Güncelleme indirildi, kuruluma geç
autoUpdater.on('update-downloaded', () => {
    log.info('Güncelleme indi. Uygulama yeniden başlatılıyor...');
    // Kullanıcıya sormadan kur ve yeniden başlat (Discord tarzı)
    autoUpdater.quitAndInstall();
});

// Güncelleme hatası olursa
autoUpdater.on('error', (err) => {
    log.error('Güncelleme hatası:', err);
});

// --- UYGULAMA YAŞAM DÖNGÜSÜ ---

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});