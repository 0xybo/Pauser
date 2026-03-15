import { computed, ref } from 'vue';

function capitalize(value) {
	if (!value) return '';
	return value.charAt(0).toUpperCase() + value.slice(1);
}

export function usePauserStore() {
	const profiles = ref([]);
	const currentId = ref(null);
	const settings = ref({ pssuspendPath: 'pssuspend64' });
	const settingsPath = ref('pssuspend64');

	const processes = ref([]);
	const showAllProcesses = ref(false);
	const processQuery = ref('');
	const selectedProcessNames = ref([]);

	const showNewProfileModal = ref(false);
	const showAddAppsModal = ref(false);
	const showSettingsModal = ref(false);
	const newProfileName = ref('');

	const logs = ref([]);
	const showLogsModal = ref(false);
	const currentView = ref('home');
	const homeQuery = ref('');
	const homeShowAll = ref(false);
	const homePausedProcesses = ref([]);

	const toasts = ref([]);
	let refreshTimer = null;

	const processMap = computed(() => {
		const map = {};
		for (const process of processes.value) {
			const key = (process.Name || '').toLowerCase();
			if (!key) continue;
			if (!map[key]) map[key] = [];
			map[key].push(process.Id);
		}
		return map;
	});

	const currentProfile = computed(() => {
		return profiles.value.find((profile) => profile.id === currentId.value) ?? null;
	});

	const filteredProcessOptions = computed(() => {
		const query = processQuery.value.trim().toLowerCase();
		const candidates = showAllProcesses.value ? [...processes.value] : processes.value.filter((item) => item.HasWindow);

		const dedup = new Map();
		for (const item of candidates) {
			const key = (item.Name || '').toLowerCase();
			if (!key) continue;
			if (!dedup.has(key) || (item.HasWindow && !dedup.get(key).HasWindow)) {
				dedup.set(key, item);
			}
		}

		let result = [...dedup.values()];
		if (query) {
			result = result.filter((item) => {
				const name = (item.Name || '').toLowerCase();
				const title = String(item.Title || '').toLowerCase();
				return name.includes(query) || title.includes(query);
			});
		}
		result.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
		return result;
	});

	const filteredHomeProcesses = computed(() => {
		const query = homeQuery.value.trim().toLowerCase();
		const candidates = homeShowAll.value ? [...processes.value] : processes.value.filter((item) => item.HasWindow);

		const dedup = new Map();
		for (const item of candidates) {
			const key = (item.Name || '').toLowerCase();
			if (!key) continue;
			if (!dedup.has(key) || (item.HasWindow && !dedup.get(key).HasWindow)) {
				dedup.set(key, item);
			}
		}

		let result = [...dedup.values()];
		if (query) {
			result = result.filter((item) => {
				const name = (item.Name || '').toLowerCase();
				const title = String(item.Title || '').toLowerCase();
				return name.includes(query) || title.includes(query);
			});
		}
		result.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
		return result;
	});

	function pushToast(message, type = 'info') {
		const id = crypto.randomUUID();
		toasts.value.push({ id, message, type });
		setTimeout(() => {
			toasts.value = toasts.value.filter((toast) => toast.id !== id);
		}, 3200);
	}

	function pushLog(message, level = 'info') {
		const id = crypto.randomUUID();
		const time = new Date().toLocaleTimeString();
		logs.value.unshift({ id, time, level, message });
		if (logs.value.length > 500) logs.value = logs.value.slice(0, 500);
	}

	function clearLogs() {
		logs.value = [];
	}

	function logRowClass(level) {
		if (level === 'error') return 'bg-rose-950/30';
		if (level === 'warning') return 'bg-amber-950/30';
		if (level === 'success') return 'bg-emerald-950/20';
		return '';
	}

	function logTextClass(level) {
		if (level === 'error') return 'text-rose-300';
		if (level === 'warning') return 'text-amber-300';
		if (level === 'success') return 'text-emerald-300';
		return 'text-slate-300';
	}

	function isHomePaused(processName) {
		return homePausedProcesses.value.includes(processName.toLowerCase());
	}

	async function pauseProcessHome(processName) {
		await refreshProcesses();
		const pids = processMap.value[processName.toLowerCase()] || [];
		if (!pids.length) {
			pushToast(`${processName} is not running`, 'warning');
			pushLog(`Pause skipped - ${processName} not running`, 'warning');
			return;
		}
		const results = await Promise.all(pids.map((pid) => window.api.pauseProcess(pid)));
		const output = results
			.map((r) => [r.stdout, r.stderr].filter(Boolean).join(' '))
			.filter(Boolean)
			.join(' | ');
		if (results.some((r) => r.success)) {
			if (!homePausedProcesses.value.includes(processName.toLowerCase())) homePausedProcesses.value = [...homePausedProcesses.value, processName.toLowerCase()];
			pushToast(`${processName} paused`, 'success');
			pushLog(`Paused ${processName}${output ? ' - ' + output : ''}`, 'success');
		} else {
			const error = results[0]?.error || `Failed to pause ${processName}`;
			pushToast(error, 'error');
			pushLog(`Pause error [${processName}]: ${error}${output ? ' - ' + output : ''}`, 'error');
		}
	}

	async function resumeProcessHome(processName) {
		await refreshProcesses();
		const pids = processMap.value[processName.toLowerCase()] || [];
		if (!pids.length) {
			pushToast(`${processName} is not running`, 'warning');
			pushLog(`Resume skipped - ${processName} not running`, 'warning');
			return;
		}
		const results = await Promise.all(pids.map((pid) => window.api.resumeProcess(pid)));
		const output = results
			.map((r) => [r.stdout, r.stderr].filter(Boolean).join(' '))
			.filter(Boolean)
			.join(' | ');
		if (results.some((r) => r.success)) {
			homePausedProcesses.value = homePausedProcesses.value.filter((n) => n !== processName.toLowerCase());
			pushToast(`${processName} resumed`, 'success');
			pushLog(`Resumed ${processName}${output ? ' - ' + output : ''}`, 'success');
		} else {
			const error = results[0]?.error || `Failed to resume ${processName}`;
			pushToast(error, 'error');
			pushLog(`Resume error [${processName}]: ${error}${output ? ' - ' + output : ''}`, 'error');
		}
	}

	async function saveProfiles() {
		const plainProfiles = JSON.parse(JSON.stringify(profiles.value));
		await window.api.saveProfiles(plainProfiles);
	}

	async function init() {
		const [loadedProfiles, loadedSettings] = await Promise.all([window.api.getProfiles(), window.api.getSettings()]);
		profiles.value = Array.isArray(loadedProfiles) ? loadedProfiles : [];
		settings.value = loadedSettings || { pssuspendPath: 'pssuspend64' };
		settingsPath.value = settings.value.pssuspendPath || 'pssuspend64';
		if (profiles.value.length > 0) currentId.value = profiles.value[0].id;
		await refreshProcesses();
		refreshTimer = setInterval(refreshProcesses, 12000);
	}

	function dispose() {
		if (refreshTimer) clearInterval(refreshTimer);
		refreshTimer = null;
	}

	async function refreshProcesses() {
		const result = await window.api.getProcesses();
		if (!Array.isArray(result)) return;
		processes.value = result;
	}

	function selectProfile(profileId) {
		currentId.value = profileId;
	}

	async function createProfile() {
		const name = newProfileName.value.trim();
		if (!name) return;
		const profile = { id: crypto.randomUUID(), name, apps: [] };
		profiles.value.push(profile);
		currentId.value = profile.id;
		newProfileName.value = '';
		showNewProfileModal.value = false;
		await saveProfiles();
		pushToast('Profile created', 'success');
	}

	async function deleteCurrentProfile() {
		const profile = currentProfile.value;
		if (!profile) return;
		if (!confirm(`Delete profile "${profile.name}"?`)) return;
		profiles.value = profiles.value.filter((item) => item.id !== profile.id);
		currentId.value = profiles.value.length ? profiles.value[0].id : null;
		await saveProfiles();
		pushToast('Profile deleted', 'info');
	}

	function openAddAppsModal() {
		selectedProcessNames.value = [];
		showAllProcesses.value = false;
		processQuery.value = '';
		showAddAppsModal.value = true;
		refreshProcesses();
	}

	function toggleProcessSelection(name) {
		const key = name.toLowerCase();
		if (selectedProcessNames.value.includes(key)) {
			selectedProcessNames.value = selectedProcessNames.value.filter((item) => item !== key);
			return;
		}
		selectedProcessNames.value = [...selectedProcessNames.value, key];
	}

	function isSelected(name) {
		return selectedProcessNames.value.includes(name.toLowerCase());
	}

	function isAlreadyAdded(name) {
		if (!currentProfile.value) return false;
		const key = name.toLowerCase();
		return currentProfile.value.apps.some((app) => app.processName.toLowerCase() === key);
	}

	async function addSelectedApps() {
		if (!currentProfile.value) return;
		if (selectedProcessNames.value.length === 0) {
			pushToast('Select at least one app', 'warning');
			return;
		}
		const existing = new Set(currentProfile.value.apps.map((app) => app.processName.toLowerCase()));
		for (const processName of selectedProcessNames.value) {
			if (existing.has(processName)) continue;
			currentProfile.value.apps.push({
				processName,
				displayName: capitalize(processName),
				paused: false
			});
			existing.add(processName);
		}
		await saveProfiles();
		showAddAppsModal.value = false;
		pushToast('Apps added to profile', 'success');
	}

	async function removeApp(processName) {
		if (!currentProfile.value) return;
		currentProfile.value.apps = currentProfile.value.apps.filter((app) => app.processName.toLowerCase() !== processName.toLowerCase());
		await saveProfiles();
	}

	function getAppStatus(app) {
		const pids = processMap.value[app.processName.toLowerCase()];
		if (!pids || pids.length === 0) return 'not-running';
		return app.paused ? 'paused' : 'running';
	}

	async function pauseApp(processName) {
		await refreshProcesses();
		const pids = processMap.value[processName.toLowerCase()] || [];
		if (!pids.length) {
			pushToast(`${processName} is not running`, 'warning');
			return;
		}
		const results = await Promise.all(pids.map((pid) => window.api.pauseProcess(pid)));
		const output = results
			.map((r) => [r.stdout, r.stderr].filter(Boolean).join(' '))
			.filter(Boolean)
			.join(' | ');
		if (results.some((result) => result.success)) {
			const app = currentProfile.value?.apps.find((item) => item.processName.toLowerCase() === processName.toLowerCase());
			if (app) app.paused = true;
			await saveProfiles();
			pushToast(`${processName} paused`, 'success');
			pushLog(`Paused ${processName} [profile]${output ? ' — ' + output : ''}`, 'success');
			return;
		}
		const error = results[0]?.error || `Failed to pause ${processName}`;
		pushToast(error, 'error');
		pushLog(`Pause error [${processName}] [profile]: ${error}${output ? ' — ' + output : ''}`, 'error');
	}

	async function resumeApp(processName) {
		await refreshProcesses();
		const pids = processMap.value[processName.toLowerCase()] || [];
		if (!pids.length) {
			pushToast(`${processName} is not running`, 'warning');
			return;
		}
		const results = await Promise.all(pids.map((pid) => window.api.resumeProcess(pid)));
		const output = results
			.map((r) => [r.stdout, r.stderr].filter(Boolean).join(' '))
			.filter(Boolean)
			.join(' | ');
		if (results.some((result) => result.success)) {
			const app = currentProfile.value?.apps.find((item) => item.processName.toLowerCase() === processName.toLowerCase());
			if (app) app.paused = false;
			await saveProfiles();
			pushToast(`${processName} resumed`, 'success');
			pushLog(`Resumed ${processName} [profile]${output ? ' — ' + output : ''}`, 'success');
			return;
		}
		const error = results[0]?.error || `Failed to resume ${processName}`;
		pushToast(error, 'error');
		pushLog(`Resume error [${processName}] [profile]: ${error}${output ? ' — ' + output : ''}`, 'error');
	}

	async function pauseAllCurrentProfile() {
		if (!currentProfile.value) return;
		for (const app of currentProfile.value.apps) {
			if (!app.paused) {
				await pauseApp(app.processName);
			}
		}
	}

	async function resumeAllCurrentProfile() {
		if (!currentProfile.value) return;
		for (const app of currentProfile.value.apps) {
			if (app.paused) {
				await resumeApp(app.processName);
			}
		}
	}

	function openSettingsModal() {
		settingsPath.value = settings.value.pssuspendPath || 'pssuspend64';
		showSettingsModal.value = true;
	}

	async function browsePssuspend() {
		const file = await window.api.selectFile();
		if (file) settingsPath.value = file;
	}

	async function saveSettings() {
		const value = settingsPath.value.trim();
		if (!value) return;
		settings.value = { ...settings.value, pssuspendPath: value };
		const plainSettings = JSON.parse(JSON.stringify(settings.value));
		await window.api.saveSettings(plainSettings);
		showSettingsModal.value = false;
		pushToast('Settings saved', 'success');
	}

	function profileMeta(profile) {
		const count = profile.apps.length;
		const paused = profile.apps.filter((app) => app.paused).length;
		return `${count} app${count === 1 ? '' : 's'}${paused ? ` · ${paused} paused` : ''}`;
	}

	function statusChipClass(status) {
		if (status === 'paused') return 'bg-amber-950/80 text-amber-300 border border-amber-800/80';
		if (status === 'running') return 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80';
		return 'bg-slate-900 text-slate-400 border border-slate-700';
	}

	function statusLabel(status) {
		if (status === 'paused') return 'Paused';
		if (status === 'running') return 'Running';
		return 'Not Running';
	}

	return {
		profiles,
		currentId,
		settingsPath,
		showAllProcesses,
		processQuery,
		selectedProcessNames,
		showNewProfileModal,
		showAddAppsModal,
		showSettingsModal,
		newProfileName,
		toasts,
		currentProfile,
		filteredProcessOptions,
		logs,
		showLogsModal,
		currentView,
		homeQuery,
		homeShowAll,
		homePausedProcesses,
		filteredHomeProcesses,
		init,
		dispose,
		refreshProcesses,
		selectProfile,
		createProfile,
		deleteCurrentProfile,
		openAddAppsModal,
		toggleProcessSelection,
		isSelected,
		isAlreadyAdded,
		addSelectedApps,
		removeApp,
		getAppStatus,
		pauseApp,
		resumeApp,
		pauseAllCurrentProfile,
		resumeAllCurrentProfile,
		openSettingsModal,
		browsePssuspend,
		saveSettings,
		profileMeta,
		statusChipClass,
		statusLabel,
		clearLogs,
		logRowClass,
		logTextClass,
		isHomePaused,
		pauseProcessHome,
		resumeProcessHome
	};
}
