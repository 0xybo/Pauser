'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
	getProcesses: () => ipcRenderer.invoke('get-processes'),
	getProfiles: () => ipcRenderer.invoke('get-profiles'),
	saveProfiles: (profiles) => ipcRenderer.invoke('save-profiles', profiles),
	getSettings: () => ipcRenderer.invoke('get-settings'),
	saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
	selectFile: () => ipcRenderer.invoke('select-file'),
	pauseProcess: (pid) => ipcRenderer.invoke('pause-process', pid),
	resumeProcess: (pid) => ipcRenderer.invoke('resume-process', pid)
});
