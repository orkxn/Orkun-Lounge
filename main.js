const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
    // 1. Pencere Ayarları
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Orkun Lounge",
        // icon: path.join(__dirname, 'public/favicon.ico'), // İleride ikon ekleyince burayı açarsın
        webPreferences: {
            nodeIntegration: false, // Güvenlik için kapalı tutuyoruz
            contextIsolation: true,
            // 2. Ses ve Video İzinlerini Otomatik Onayla (Discord gibi)
            permissionRequestHandler: (webContents, permission, callback) => {
                const allowedPermissions = ['media', 'audioCapture', 'videoCapture'];
                if (allowedPermissions.includes(permission)) {
                    callback(true); // Kullanıcıya sormadan izin ver
                } else {
                    callback(false);
                }
            }
        }
    });

    // 3. Menü Çubuğunu Gizle (Tam modern görünüm için)
    win.setMenuBarVisibility(false);

    // 4. Hangi Adrese Bağlanacak?
    // Geliştirme yaparken 'http://localhost:4444' adresine,
    // Uygulama bittiğinde 'https://orkunlounge.onrender.com' adresine bağlanacak.
    const appUrl = 'https://orkunlounge.onrender.com'; 
    // CANLIYA ALIRKEN ÜSTTEKİ SATIRI SİLİP BUNU AÇACAKSIN:
    // const appUrl = 'https://orkunlounge.onrender.com';

    win.loadURL(appUrl);

    // Linklere tıklayınca uygulamanın içinde değil, varsayılan tarayıcıda açılması için
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

// Electron hazır olduğunda pencereyi aç
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Tüm pencereler kapandığında uygulamadan çık (Mac hariç standart davranış)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});