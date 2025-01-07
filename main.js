const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

// Wait until Electron is ready
app.on("ready", () => {
  mainWindow = new BrowserWindow({
    width: 3840,
    height: 2160,
    fullscreen: true, // Fullscreen for screensaver mode
    frame: false,     // No window frame
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Link to preload.js
      contextIsolation: true,                      // Enable context isolation
      nodeIntegration: false,                      // Disable Node.js integration
    },
  });

  // Load the HTML file
  mainWindow.loadFile("index.html");

  // Handle window close
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
});

// Determine the folder based on the time of day
function getFolderByTime() {
  const currentHour = new Date().getHours();
  if (currentHour >= 5 && currentHour < 9) return "Sunrise";
  if (currentHour >= 9 && currentHour < 17) return "MidDay";
  if (currentHour >= 17 && currentHour < 20) return "Sunset";
  return "Night";
}

// Handle request for video files
ipcMain.handle("get-video-files", async () => {
  const folder = getFolderByTime();
  const videoDir = path.join(__dirname, "videos", folder);

  console.log("Selected folder:", videoDir);

  try {
    const files = fs.readdirSync(videoDir).filter(file => {
      return file.endsWith(".mp4") || file.endsWith(".mov") || file.endsWith(".mkv");
    });

    console.log("Files in selected folder:", files);
    return files;
  } catch (err) {
    console.error("Error reading video directory:", err);
    return [];
  }
});

// Handle exit on user activity
ipcMain.on("exit-screensaver", () => {
  console.log("Exiting screensaver...");
  app.quit();
});

// Handle when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});