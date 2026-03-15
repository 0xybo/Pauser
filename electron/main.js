'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

let mainWindow;
let profilesFilePath;
let settingsFilePath;

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1150,
		height: 720,
		minWidth: 860,
		minHeight: 560,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false
		},
		title: 'Pauser',
		backgroundColor: '#0d0d14',
		autoHideMenuBar: true,
		show: false
	});

	mainWindow.once('ready-to-show', () => mainWindow.show());
	if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
	mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
	const userData = app.getPath('userData');
	profilesFilePath = path.join(userData, 'profiles.json');
	settingsFilePath = path.join(userData, 'settings.json');
	createWindow();
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJSON(filePath, fallback) {
	try {
		if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch {}
	return fallback;
}

function writeJSON(filePath, data) {
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getSettings() {
	return readJSON(settingsFilePath, { pssuspendPath: 'pssuspend64' });
}

// ─── IPC: Processes ───────────────────────────────────────────────────────────

const PS_COMMAND =
	'Get-Process | Select-Object Name,Id,' +
	"@{Name='Title';Expression={$_.MainWindowTitle}}," +
	"@{Name='HasWindow';Expression={$_.MainWindowHandle -ne 0}}" +
	' | Sort-Object Name | ConvertTo-Json -Compress';

ipcMain.handle('get-processes', async () => {
	try {
		const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS_COMMAND], { timeout: 15000 });
		const raw = stdout.trim();
		if (!raw) return [];
		const data = JSON.parse(raw);
		return Array.isArray(data) ? data : [data];
	} catch (err) {
		return { error: err.message };
	}
});

// ─── IPC: Profiles ────────────────────────────────────────────────────────────

ipcMain.handle('get-profiles', () => readJSON(profilesFilePath, []));

ipcMain.handle('save-profiles', (_, profiles) => {
	if (!Array.isArray(profiles)) return false;
	try {
		writeJSON(profilesFilePath, profiles);
		return true;
	} catch {
		return false;
	}
});

// ─── IPC: Settings ────────────────────────────────────────────────────────────

ipcMain.handle('get-settings', () => getSettings());

ipcMain.handle('save-settings', (_, settings) => {
	if (!settings || typeof settings !== 'object') return false;
	try {
		writeJSON(settingsFilePath, settings);
		return true;
	} catch {
		return false;
	}
});

ipcMain.handle('select-file', async () => {
	const result = await dialog.showOpenDialog(mainWindow, {
		title: 'Select pssuspend64.exe',
		filters: [{ name: 'Executables', extensions: ['exe'] }],
		properties: ['openFile']
	});
	return !result.canceled && result.filePaths.length > 0 ? result.filePaths[0] : null;
});

// ─── IPC: Suspend / Resume ────────────────────────────────────────────────────

async function toggleProcess(pid, resume) {
	const safePid = parseInt(pid, 10);
	if (!Number.isFinite(safePid) || safePid <= 0) {
		return { success: false, error: 'Invalid PID' };
	}

	const { pssuspendPath } = getSettings();
	const args = resume ? ['-accepteula', '-r', String(safePid)] : ['-accepteula', String(safePid)];

	try {
		const { stdout, stderr } = await execFileAsync(pssuspendPath, args, { timeout: 10000 });
		return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
	} catch (err) {
		let error = err.message;
		if (err.code === 'ENOENT') {
			error = 'pssuspend64 not found. Configure its path in Settings.';
		} else if (error.includes('Access is denied') || error.includes('1314')) {
			error = 'Access denied. Try running Pauser as Administrator.';
		}
		return { success: false, error };
	}
}

ipcMain.handle('pause-process', (_, pid) => toggleProcess(pid, false));
ipcMain.handle('resume-process', (_, pid) => toggleProcess(pid, true));
