<script>
	import { onMounted, onUnmounted } from 'vue';
	import { usePauserStore } from '../store/pauserStore.js';

	export default {
		name: 'AppRoot',
		setup() {
			const store = usePauserStore();
			onMounted(() => store.init());
			onUnmounted(() => store.dispose());
			return store;
		}
	};
</script>

<template>
	<div class="h-full md:flex">
		<aside class="h-56 border-b border-slate-800 bg-slate-900/90 backdrop-blur md:h-full md:w-72 md:border-b-0 md:border-r">
			<div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
				<div>
					<p class="text-xs uppercase tracking-[0.2em] text-slate-500">Pauser</p>
					<h1 class="text-lg font-semibold text-slate-100">Profiles</h1>
				</div>
				<div class="flex gap-2">
					<button class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800" @click="showNewProfileModal = true">New</button>
					<button class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800" @click="showLogsModal = true">Logs</button>
					<button class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800" @click="openSettingsModal">Settings</button>
				</div>
			</div>
			<div class="h-[calc(100%-57px)] space-y-2 overflow-y-auto p-3">
				<button
					v-for="profile in profiles"
					:key="profile.id"
					@click="selectProfile(profile.id)"
					class="w-full rounded-xl border px-3 py-2 text-left transition"
					:class="currentId === profile.id ? 'border-sky-500/70 bg-sky-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'"
				>
					<p class="truncate text-sm font-semibold">{{ profile.name }}</p>
					<p class="truncate text-xs text-slate-400">{{ profileMeta(profile) }}</p>
				</button>
				<div v-if="profiles.length === 0" class="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-400">No profiles yet</div>
			</div>
		</aside>

		<main class="flex h-[calc(100%-14rem)] flex-1 flex-col overflow-hidden md:h-full">
			<div class="flex gap-1 border-b border-slate-800 bg-slate-900/50 px-4 py-2">
				<button
					@click="currentView = 'home'"
					class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
					:class="currentView === 'home' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'"
				>
					Home
				</button>
				<button
					@click="currentView = 'profiles'"
					class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
					:class="currentView === 'profiles' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'"
				>
					Profiles
				</button>
			</div>

			<div v-if="currentView === 'home'" class="flex flex-1 flex-col overflow-hidden">
				<div class="flex flex-wrap gap-2 border-b border-slate-800 p-4">
					<input
						v-model="homeQuery"
						placeholder="Search process..."
						class="min-w-56 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-sky-500/50 focus:ring"
					/>
					<label class="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs">
						<input type="checkbox" v-model="homeShowAll" class="accent-sky-500" />
						Show all
					</label>
					<button @click="refreshProcesses" class="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">Refresh</button>
				</div>
				<div class="flex-1 overflow-y-auto p-4">
					<div class="mx-auto max-w-5xl space-y-2">
						<div v-if="filteredHomeProcesses.length === 0" class="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No processes found.</div>
						<div v-for="proc in filteredHomeProcesses" :key="proc.Name" class="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
							<div class="grid h-10 w-10 place-items-center rounded-lg bg-slate-800 text-sm font-bold uppercase">{{ proc.Name.charAt(0) }}</div>
							<div class="min-w-[9rem] flex-1">
								<p class="font-semibold">{{ proc.Name }}</p>
								<p class="text-xs text-slate-400">{{ proc.Title || 'No window title' }}</p>
							</div>
							<span
								class="rounded-full border px-2.5 py-1 text-xs font-semibold"
								:class="isHomePaused(proc.Name) ? 'border-amber-800/80 bg-amber-950/80 text-amber-300' : 'border-emerald-800/80 bg-emerald-950/80 text-emerald-300'"
							>
								{{ isHomePaused(proc.Name) ? 'Paused' : 'Running' }}
							</span>
							<div class="flex gap-2">
								<button
									v-if="!isHomePaused(proc.Name)"
									@click="pauseProcessHome(proc.Name)"
									class="rounded-lg border border-amber-700 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/60"
								>
									Pause
								</button>
								<button
									v-else
									@click="resumeProcessHome(proc.Name)"
									class="rounded-lg border border-emerald-700 bg-emerald-900/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/60"
								>
									Resume
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div v-else class="flex-1 overflow-y-auto">
				<div class="mx-auto max-w-5xl p-4 md:p-8">
					<div v-if="!currentProfile" class="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center">
						<h2 class="text-2xl font-semibold">Select or create a profile</h2>
						<p class="mt-3 text-sm text-slate-400">Group apps by use-case and pause or resume them in one click.</p>
						<button class="mt-6 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400" @click="showNewProfileModal = true">
							Create profile
						</button>
					</div>

					<div v-else class="space-y-6">
						<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div>
									<h2 class="text-2xl font-bold tracking-tight">{{ currentProfile.name }}</h2>
									<p class="text-sm text-slate-400">{{ profileMeta(currentProfile) }}</p>
								</div>
								<div class="flex flex-wrap gap-2">
									<button class="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800" @click="refreshProcesses">Refresh</button>
									<button
										class="rounded-lg border border-emerald-700 bg-emerald-900/40 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/60"
										@click="resumeAllCurrentProfile"
									>
										Resume all
									</button>
									<button
										class="rounded-lg border border-amber-700 bg-amber-900/40 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-900/60"
										@click="pauseAllCurrentProfile"
									>
										Pause all
									</button>
									<button class="rounded-lg border border-rose-700 bg-rose-900/30 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-900/50" @click="deleteCurrentProfile">
										Delete
									</button>
								</div>
							</div>
						</div>

						<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
							<div class="mb-4 flex items-center justify-between">
								<h3 class="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Apps</h3>
								<button class="rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-sky-400" @click="openAddAppsModal">Add apps</button>
							</div>

							<div v-if="currentProfile.apps.length === 0" class="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
								No apps in this profile yet.
							</div>

							<div v-else class="space-y-3">
								<div v-for="app in currentProfile.apps" :key="app.processName" class="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
									<div class="grid h-10 w-10 place-items-center rounded-lg bg-slate-800 text-sm font-bold uppercase">{{ app.processName.charAt(0) }}</div>
									<div class="min-w-[9rem] flex-1">
										<p class="font-semibold">{{ app.displayName }}</p>
										<p class="text-xs text-slate-400">{{ app.processName }}.exe</p>
									</div>
									<span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="statusChipClass(getAppStatus(app))">{{ statusLabel(getAppStatus(app)) }}</span>
									<div class="flex gap-2">
										<button
											v-if="getAppStatus(app) !== 'paused'"
											class="rounded-lg border border-amber-700 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/60"
											@click="pauseApp(app.processName)"
										>
											Pause
										</button>
										<button
											v-else
											class="rounded-lg border border-emerald-700 bg-emerald-900/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/60"
											@click="resumeApp(app.processName)"
										>
											Resume
										</button>
										<button class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800" @click="removeApp(app.processName)">
											Remove
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>

		<div v-if="showNewProfileModal" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" @click.self="showNewProfileModal = false">
			<div class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
				<h3 class="text-lg font-semibold">Create profile</h3>
				<input
					v-model="newProfileName"
					@keydown.enter="createProfile"
					class="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-sky-500/50 focus:ring"
					placeholder="Gaming, Work, Study..."
				/>
				<div class="mt-4 flex justify-end gap-2">
					<button class="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800" @click="showNewProfileModal = false">Cancel</button>
					<button class="rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400" @click="createProfile">Create</button>
				</div>
			</div>
		</div>

		<div v-if="showAddAppsModal" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" @click.self="showAddAppsModal = false">
			<div class="flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-slate-900">
				<div class="flex flex-wrap gap-2 border-b border-slate-800 p-4">
					<input
						v-model="processQuery"
						placeholder="Search process..."
						class="min-w-56 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-sky-500/50 focus:ring"
					/>
					<label class="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs">
						<input type="checkbox" v-model="showAllProcesses" class="accent-sky-500" />
						Show all
					</label>
					<button class="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800" @click="refreshProcesses">Refresh</button>
				</div>
				<div class="flex-1 space-y-2 overflow-y-auto p-4">
					<label
						v-for="process in filteredProcessOptions"
						:key="process.Name"
						class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"
						:class="isAlreadyAdded(process.Name) ? 'opacity-50' : ''"
					>
						<input type="checkbox" :disabled="isAlreadyAdded(process.Name)" :checked="isSelected(process.Name)" @change="toggleProcessSelection(process.Name)" class="accent-sky-500" />
						<div class="grid h-9 w-9 place-items-center rounded-lg bg-slate-800 text-xs font-bold uppercase">{{ process.Name.charAt(0) }}</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold">{{ process.Name }}</p>
							<p class="truncate text-xs text-slate-400">{{ process.Title || 'No window title' }}</p>
						</div>
						<span v-if="isAlreadyAdded(process.Name)" class="rounded-full border border-slate-600 px-2 py-1 text-[11px]">Added</span>
					</label>
				</div>
				<div class="flex items-center justify-between border-t border-slate-800 p-4">
					<p class="text-xs text-slate-400">{{ selectedProcessNames.length }} selected</p>
					<div class="flex gap-2">
						<button class="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800" @click="showAddAppsModal = false">Cancel</button>
						<button class="rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400" @click="addSelectedApps">Add selected</button>
					</div>
				</div>
			</div>
		</div>

		<div v-if="showSettingsModal" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" @click.self="showSettingsModal = false">
			<div class="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5">
				<h3 class="text-lg font-semibold">Settings</h3>
				<label class="mt-4 block text-xs uppercase tracking-[0.15em] text-slate-400">pssuspend64 path</label>
				<div class="mt-2 flex gap-2">
					<input v-model="settingsPath" class="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-sky-500/50 focus:ring" />
					<button class="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800" @click="browsePssuspend">Browse</button>
				</div>
				<p class="mt-3 text-xs text-slate-400">Use full path to pssuspend64.exe or keep pssuspend64 if available in PATH.</p>
				<div class="mt-4 flex justify-end gap-2">
					<button class="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800" @click="showSettingsModal = false">Cancel</button>
					<button class="rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400" @click="saveSettings">Save</button>
				</div>
			</div>
		</div>

		<div v-if="showLogsModal" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" @click.self="showLogsModal = false">
			<div class="flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-slate-900">
				<div class="flex items-center justify-between border-b border-slate-800 p-4">
					<h3 class="text-lg font-semibold">Logs</h3>
					<button @click="clearLogs" class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">Clear</button>
				</div>
				<div class="flex-1 space-y-0.5 overflow-y-auto p-4 font-mono text-xs">
					<div v-if="logs.length === 0" class="py-8 text-center text-slate-500">No logs yet.</div>
					<div v-for="entry in logs" :key="entry.id" class="flex gap-3 rounded px-2 py-1" :class="logRowClass(entry.level)">
						<span class="shrink-0 text-slate-500">{{ entry.time }}</span>
						<span :class="logTextClass(entry.level)" class="whitespace-pre-wrap break-all">{{ entry.message }}</span>
					</div>
				</div>
				<div class="flex justify-end border-t border-slate-800 p-4">
					<button @click="showLogsModal = false" class="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">Close</button>
				</div>
			</div>
		</div>

		<div class="pointer-events-none fixed bottom-4 right-4 z-[70] space-y-2">
			<div
				v-for="toast in toasts"
				:key="toast.id"
				class="toast-in rounded-lg border px-4 py-2 text-sm font-medium shadow-lg"
				:class="
					toast.type === 'error'
						? 'border-rose-700 bg-rose-950/90 text-rose-200'
						: toast.type === 'warning'
							? 'border-amber-700 bg-amber-950/90 text-amber-200'
							: toast.type === 'success'
								? 'border-emerald-700 bg-emerald-950/90 text-emerald-200'
								: 'border-sky-700 bg-sky-950/90 text-sky-100'
				"
			>
				{{ toast.message }}
			</div>
		</div>
	</div>
</template>
