const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
let settingsWindow;
let kioskMode;

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
  return { kioskMode: false }; // Default settings
}

function saveSettings(newSettings) {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(newSettings, null, 2));
    console.log("✅ Settings saved:", newSettings);
  } catch (err) {
    console.error("❌ Error saving settings:", err);
  }
}

// ✅ Time-based video folder selection
function getFolderByTime() {
  const currentHour = new Date().getHours();
  if (currentHour >= 5 && currentHour < 9) return "Sunrise";
  if (currentHour >= 9 && currentHour < 17) return "MidDay";
  if (currentHour >= 17 && currentHour < 19) return "Sunset";
  return "Night"; // Default
}

// ✅ Get video files based on time
ipcMain.handle("get-video-files", async () => {
  console.log("📂 Fetching video files...");
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

    if (files.length === 0) {
      console.warn("⚠️ No video files found!");
      return [];
    }

    console.log("🎥 Files found:", files);
    return files.map(file => path.join(videoDir, file));
  } catch (err) {
    console.error("❌ Error reading video directory:", err);
    return [];
  }
});

// ✅ Create Screensaver Window
function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return;

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
    setTimeout(() => mainWindow.show(), 1000); // Ensures the window appears
  });

  mainWindow.on("closed", () => {
    console.log("📺 Main window closed.");
    mainWindow = null;
  });
}

// ✅ Fix: Close settings window when "Apply" is clicked
function createSettingsWindow() {
  if (settingsWindow) return;

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

  ipcMain.once("apply-settings", (event, newSettings) => {
    console.log("⚙️ Applying new settings:", newSettings);
    saveSettings(newSettings);
    kioskMode = newSettings.kioskMode;
    settingsWindow.close(); // ✅ Close settings on Apply

    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log("🔄 Returning to screensaver...");
      mainWindow.show();
    }
  });

  settingsWindow.on("closed", () => {
    console.log("⚙️ Settings window closed.");
    settingsWindow = null;
  });
}

// ✅ Register Hotkeys
function registerHotkeys() {
  const settingsShortcut = process.platform === "darwin" ? "Command+S+A" : "Control+S+A";
  globalShortcut.register(settingsShortcut, createSettingsWindow);

  globalShortcut.register("Escape", () => {
    if (kioskMode) {
      console.log("🚀 Escape Key Pressed. Exiting Kiosk Mode...");
      app.quit();
    } else {
      console.log("✅ Escape Key Pressed. Hiding Screensaver...");
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
    }
  });
}

// ✅ Start Electron App
app.whenReady().then(() => {
  console.log("🚀 Electron app ready.");
  const settings = loadSettings();
  kioskMode = settings.kioskMode;
  registerHotkeys();
  createMainWindow();
});

// ✅ Quit when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});