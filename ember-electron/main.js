/* eslint-env node */
const { app, BrowserWindow, protocol } = require("electron");
const { dirname, join, resolve } = require("path");
const protocolServe = require("electron-protocol-serve");
const protocols = require("electron-protocols");

let appPath = resolve("../..");
let config = require(join(appPath, "config.json"));

//const reload = require('electron-reload')
//reload(appPath)

/*require("electron-dl")({
  saveAs: true
});*/

let mainWindow = null;
// Registering a protocol & schema to serve our Ember application
protocol.registerStandardSchemes(["serve"], { secure: true });
protocolServe({
  cwd: join(__dirname || resolve(dirname("")), "..", "ember"),
  app,
  protocol,
  name: "serve",
  endpoint: "dist"
});

protocols.register("asset", uri => {
  let base = config.dataPath; // app.getAppPath();
  console.log(uri.host);

  if (uri.pathname) {
    console.log(join(base, uri.host, uri.pathname))
    return join(base, uri.host, uri.pathname);
  }
  console.log(join(base, uri.host))
  return join(base, uri.host);
});

// Uncomment the lines below to enable Electron's crash reporter
// For more information, see http://electron.atom.io/docs/api/crash-reporter/
// electron.crashReporter.start({
//     productName: 'YourName',
//     companyName: 'YourCompany',
//     submitURL: 'https://your-domain.com/url-to-submit',
//     autoSubmit: true
// });
//app.commandLine.appendSwitch('--disable-gpu') // --ignore-gpu-blacklist

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("ready", () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 1024,
    //frame: false,
    resizable: true,
    transparent: true,
    title: "OpenArcanum",
    alwaysOnTop: "true",
    //kiosk: true,
    autoHideMenuBar: true,
    devTools: true,
    webPreferences: {
      webviewTag: true,
      //nodeIntegration: true,
      webSecurity: false,
      experimentalFeatures: true,
      nodeIntegrationInWorker: true
    }
  });
  //mainWindow.webContents.openDevTools();
  // If you want to open up dev tools programmatically, call
  mainWindow.openDevTools();

  /*installExtension({id: 'bpconcjcammlapcogcnnelfmaeghhagj', electron: '>=1.2.1'})
  .then((name) => console.log(`Added Extension:  ${name}`))
  .catch((err) => console.log('An error occurred: ', err));*/

  const emberAppLocation = "serve://dist";
  // Load the ember application using our custom protocol/scheme
  mainWindow.loadURL(emberAppLocation);
  // If a loading operation goes wrong, we'll send Electron back to
  // Ember App entry point
  mainWindow.webContents.on("did-fail-load", () => {
    mainWindow.loadURL(emberAppLocation);
  });
  mainWindow.webContents.on("crashed", () => {
    console.log(
      "Your Ember app (or other code) in the main window has crashed."
    );
    console.log(
      "This is a serious issue that needs to be handled and/or debugged."
    );
  });
  mainWindow.on("unresponsive", () => {
    console.log(
      "Your Ember app (or other code) has made the window unresponsive."
    );
  });
  mainWindow.on("responsive", () => {
    console.log("The main window has become responsive again.");
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
});

process.on("uncaughtException", err => {
  console.log("An exception in the main thread was not handled.");
  console.log(
    "This is a serious issue that needs to be handled and/or debugged."
  );
  console.log(`Exception: ${err}`);
});
