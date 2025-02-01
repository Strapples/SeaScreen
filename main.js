const { app, BrowserWindow, ipcMain, Tray, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
let tray = null;

// ✅ Ensure IPC handler is registered BEFORE creating the window
ipcMain.handle("get-video-files", async () => {
  console.log("get-video-files handler registered.");
  const folder = getFolderByTime();
  const videoDir = path.join(__dirname, "videos", folder);

  try {
    if (!fs.existsSync(videoDir)) {
      console.error("Video folder does not exist:", videoDir);
      return [];
    }

    const files = fs.readdirSync(videoDir).filter(file =>
      file.endsWith(".mp4") || file.endsWith(".mov") || file.endsWith(".mkv")
    );

    console.log("Files in selected folder:", videoDir, files);
    return files.map(file => path.join(videoDir, file));
  } catch (err) {
    console.error("Error reading video directory:", err);
    return [];
  }
});

// ✅ Function to determine which video folder to use based on time
function getFolderByTime() {
  const currentHour = new Date().getHours();
  if (currentHour >= 5 && currentHour < 9) return "Sunrise";
  if (currentHour >= 9 && currentHour < 17) return "MidDay";
  if (currentHour >= 17 && currentHour < 19) return "Sunset";
  return "Night"; // Default to "Night"
}

// ✅ Create the main application window
function createMainWindow() {
  if (mainWindow) {
    console.log("Main window already exists. Showing instead of recreating.");
    mainWindow.show();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 3840,
    height: 2160,
    fullscreen: true,
    frame: false,
    show: false, // Start hidden
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("screensaver.html");

mainWindow.webContents.once("did-finish-load", () => {
  console.log("✅ screensaver.html finished loading. Now showing window...");
  mainWindow.show();
});

  mainWindow.on("closed", () => {
    console.log("Main window closed. Setting to null.");
    mainWindow = null;
  });
}

// ✅ Create the system tray
function createTray() {
  tray = new Tray(path.join(__dirname, "icon.png")); // Replace with your tray icon
  const contextMenu = Menu.buildFromTemplate([
    { label: "Start Screensaver", click: () => mainWindow.show() },
    { label: "Exit", click: () => app.quit() },
  ]);

  tray.setToolTip("SeaScreen Screensaver");
  tray.setContextMenu(contextMenu);
}

// ✅ Start Electron App
app.whenReady().then(() => {
  console.log("Electron app ready, creating main window...");
  createMainWindow();
  createTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ✅ Exit screensaver when user interacts
ipcMain.on("exit-screensaver", (event, data) => {
  const reason = data?.reason || "Unknown reason"; // Ensure `reason` is always defined
  console.log(`🚀 EXIT SIGNAL RECEIVED from screensaver! Reason: ${reason}`);

  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log("✅ Closing main window...");
    mainWindow.close();
  } else {
    console.error("⚠️ ERROR: Main window is already destroyed or null.");
    app.quit();
  }
});