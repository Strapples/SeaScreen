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


  // Electron is ready, tell it to ignore anything below E3 code 
  app.commandLine.appendSwitch("log-level", "3"); // Suppresses FFmpeg encoder spam
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
  if (currentHour >= 17 && currentHour < 19) return "Sunset";
  return "Night"; // Default to "Night" for hours 19-4
}

// Handle request for video files
ipcMain.handle("get-video-files", async () => {
  const folder = getFolderByTime();
  const videoDir = path.join(__dirname, "videos", folder);

  try {
    // Read video files from the selected directory
    const files = fs.readdirSync(videoDir).filter(file => file.endsWith(".mp4") || file.endsWith(".mov") || file.endsWith(".mkv"));
    console.log("Selected folder:", videoDir);
    console.log("Files in selected folder:", files);

    // Convert to absolute paths for the renderer process
    return files.map(file => path.join(videoDir, file));
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