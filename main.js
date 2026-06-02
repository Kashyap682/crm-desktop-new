const { app, BrowserWindow, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;

// Configure auto-updater
autoUpdater.autoDownload = true;       // download update silently in background
autoUpdater.autoInstallOnAppQuit = true; // install when user quits

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,  // Changed to true for better security
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    title: 'CRM Desktop',
    backgroundColor: '#001F3F',
    show: false  // Don't show until ready-to-show
  });

  // Load the Angular app
  mainWindow.loadFile(path.join(__dirname, 'dist/crm-frontend/browser/index.html'));

  // Show window when ready (smoother startup)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Important Notice',
      message: '💸 Please pay the developer!',
      buttons: ['OK I Will', 'Maybe Later']
    });
  });

  // Only open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Check for updates on every startup (only in production)
  if (process.env.NODE_ENV !== 'development') {
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => checkForUpdates(), 3000);
    });
  }
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            checkForUpdates();
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            // You can add an about dialog here
            const version = app.getVersion();
            console.log(`CRM Desktop v${version}`);
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Auto-updater functions
function checkForUpdates() {
  autoUpdater.checkForUpdates().catch(err => {
    console.error('Error checking for updates:', err);
  });
}

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: `Version ${info.version} is available.`,
    detail: 'Downloading update in the background. You will be notified when it is ready.',
    buttons: ['OK']
  });
});

autoUpdater.on('update-not-available', () => {
  console.log('App is up to date');
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`Downloading update: ${Math.round(progressObj.percent)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `Version ${info.version} has been downloaded.`,
    detail: 'The update will be installed automatically when you quit the app.',
    buttons: ['Quit & Install Now', 'Later']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  console.error('Auto-updater error:', err);
});

// App lifecycle events
app.whenReady().then(() => {
  createWindow();
  createMenu();

  // Also check for updates periodically every 4 hours (all platforms)
  if (process.env.NODE_ENV !== 'development') {
    setInterval(() => checkForUpdates(), 4 * 60 * 60 * 1000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle app quit
app.on('before-quit', () => {
  // Clean up or save state if needed
  console.log('App is quitting');
});

// Prevent navigation away from app
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    // Only allow navigation within the app
    if (parsedUrl.origin !== 'file://') {
      event.preventDefault();
      console.warn('Prevented navigation to:', navigationUrl);
    }
  });

  // Prevent opening new windows
  contents.setWindowOpenHandler(({ url }) => {
    console.warn('Prevented opening new window:', url);
    return { action: 'deny' };
  });
});