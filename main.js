const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
let settingsWindow;
let inactivityTimeout;
let kioskMode;
let inactivityTimer;

const settingsFile = path.join(app.getPath("userData"), "settings.json");

// ✅ Load & Save Settings
function loadSettings() {
  try {
    if (fs.existsSync(settingsFile)) {
      return JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    }
  } catch (err) {
    console.error("❌ Error loading settings:", err);
  }
  return { inactivityTimeout: 600000, kioskMode: false }; // Default 10 min timeout, kiosk mode off
}

function saveSettings(newSettings) {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(newSettings, null, 2));
    console.log("✅ Settings saved:", newSettings);
  } catch (err) {
    console.error("❌ Error saving settings:", err);
  }
}

// ✅ Ensure IPC handlers are registered BEFORE creating windows
ipcMain.handle("get-video-files", async () => {
  console.log("📂 Handling video file request...");
  const folder = getFolderByTime();
  const videoDir = path.join(__dirname, "videos", folder);

  try {
    if (!fs.existsSync(videoDir)) {
      console.error("❌ Video folder missing:", videoDir);
      return [];
    }

    const files = fs.readdirSync(videoDir).filter(file =>
      file.endsWith(".mp4") || file.endsWith(".mov") || file.endsWith(".mkv")
    );

    console.log("🎥 Files found:", files);
    return files.map(file => path.join(videoDir, file));
  } catch (err) {
    console.error("❌ Error reading video directory:", err);
    return [];
  }
});

ipcMain.handle("load-settings", () => loadSettings());

ipcMain.on("save-settings", (event, newSettings) => {
  saveSettings(newSettings);
  inactivityTimeout = newSettings.inactivityTimeout;
  kioskMode = newSettings.kioskMode;
  restartInactivityTimer();
});

// ✅ Function to determine time-based video folder
function getFolderByTime() {
  const currentHour = new Date().getHours();
  if (currentHour >= 5 && currentHour < 9) return "Sunrise";
  if (currentHour >= 9 && currentHour < 17) return "MidDay";
  if (currentHour >= 17 && currentHour < 19) return "Sunset";
  return "Night"; // Default to Night
}

// ✅ Create Screensaver Window
function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log("📺 Main window already exists.");
    return;
  }

  mainWindow = new BrowserWindow({
    width: 3840,
    height: 2160,
    fullscreen: true,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("screensaver.html").catch(err => {
    console.error("❌ Failed to load screensaver.html:", err);
  });

  mainWindow.webContents.once("did-finish-load", () => {
    console.log("✅ Screensaver loaded.");
    if (kioskMode) {
      console.log("🚀 Kiosk Mode enabled. Launching screensaver instantly.");
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    console.log("📺 Main window closed.");
    mainWindow = null;
  });
}

// ✅ Create Settings Window (WITH CLOSE BUTTON)
function createSettingsWindow() {
  if (settingsWindow) {
    console.log("⚙️ Settings window already open.");
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    frame: true,
    alwaysOnTop: true,
    parent: mainWindow || null,
    modal: !!mainWindow,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadFile("settings.html");

  settingsWindow.on("closed", () => {
    console.log("⚙️ Settings window closed.");
    settingsWindow = null;

    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log("🔄 Returning to screensaver...");
      mainWindow.show();
    }
  });
}

// ✅ Restart Inactivity Timer (Fixes Black Screen)
function restartInactivityTimer() {
  if (kioskMode) {
    console.log("🚀 Kiosk Mode is active. Skipping inactivity timer.");
    if (!mainWindow) createMainWindow();
    mainWindow.show();
    return;
  }

  if (inactivityTimer) clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(() => {
    console.log("⏳ Inactivity timeout reached. Starting screensaver...");
    if (!mainWindow) createMainWindow();
    mainWindow.show();
  }, inactivityTimeout);
}

// ✅ Register Global Hotkeys
function registerHotkeys() {
  globalShortcut.register("Control+S+C", () => {
    console.log("🔑 Hotkey Ctrl + S + C pressed.");
    createSettingsWindow();
  });

  globalShortcut.register("Escape", () => {
    if (kioskMode) {
      console.log("🚀 Escape Key Pressed. Exiting Kiosk Mode...");
      app.quit();
    }
  });
}

// ✅ Start Electron App
app.whenReady().then(() => {
  console.log("🚀 Electron app ready.");
  const settings = loadSettings();
  inactivityTimeout = settings.inactivityTimeout;
  kioskMode = settings.kioskMode;
  registerHotkeys();
  restartInactivityTimer();
});

// ✅ Handle Screensaver Exit (ONLY Escape Key in Kiosk Mode)
ipcMain.on("exit-screensaver", (event, data) => {
  console.log(`🛑 Exit signal received. Reason: ${data?.reason || "Unknown source"}`);

  if (kioskMode) {
    if (data?.reason === "Escape Key") {
      console.log("✅ Escape Key Pressed. Exiting Kiosk Mode...");
      app.quit();
    } else {
      console.log("🚫 Kiosk Mode active. Ignoring exit attempt.");
      return;
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log("✅ Hiding screensaver...");
    mainWindow.hide();
    restartInactivityTimer();
  } else {
    console.error("⚠️ ERROR: Main window is already destroyed or null. Preventing crash.");
  }
});

// ✅ Quit when all windows are closed (except macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});