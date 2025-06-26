import { EventEmitter } from "events"
import * as vscode from "vscode"
import fs from "fs/promises"
import * as path from "path"

import {
	CybrosysAssistaAPI,
	CybrosysAssistaSettings,
	CybrosysAssistaEvents,
	CybrosysAssistaEventName,
	ProviderSettings,
	ProviderSettingsEntry,
	isSecretStateKey,
	IpcOrigin,
	IpcMessageType,
	TaskCommandName,
	TaskEvent,
} from "@cybrosys-assista/types"
import { IpcServer } from "@cybrosys-assista/ipc"

import { Package } from "../shared/package"
import { getWorkspacePath } from "../utils/path"
import { AssistaProvider } from "../core/webview/AssistaProvider"
import { openAssistaInNewTab } from "../activate/registerCommands"

export class API extends EventEmitter<CybrosysAssistaEvents> implements CybrosysAssistaAPI {
	private readonly outputChannel: vscode.OutputChannel
	private readonly sidebarProvider: AssistaProvider
	private readonly context: vscode.ExtensionContext
	private readonly ipc?: IpcServer
	private readonly taskMap = new Map<string, AssistaProvider>()
	private readonly log: (...args: unknown[]) => void
	private logfile?: string

	constructor(
		outputChannel: vscode.OutputChannel,
		provider: AssistaProvider,
		socketPath?: string,
		enableLogging = false,
	) {
		super()

		this.outputChannel = outputChannel
		this.sidebarProvider = provider
		this.context = provider.context

		if (enableLogging) {
			this.log = (...args: unknown[]) => {
				this.outputChannelLog(...args)
				console.log(args)
			}

			this.logfile = path.join(getWorkspacePath(), "cybrosys-assista-messages.log")
		} else {
			this.log = () => {}
		}

		this.registerListeners(this.sidebarProvider)

		if (socketPath) {
			const ipc = (this.ipc = new IpcServer(socketPath, this.log))

			ipc.listen()
			this.log(`[API] ipc server started: socketPath=${socketPath}, pid=${process.pid}, ppid=${process.ppid}`)

			ipc.on(IpcMessageType.TaskCommand, async (_clientId, { commandName, data }) => {
				switch (commandName) {
					case TaskCommandName.StartNewTask:
						this.log(`[API] StartNewTask -> ${data.text}, ${JSON.stringify(data.configuration)}`)
						await this.startNewTask(data)
						break
					case TaskCommandName.CancelTask:
						this.log(`[API] CancelTask -> ${data}`)
						await this.cancelTask(data)
						break
					case TaskCommandName.CloseTask:
						this.log(`[API] CloseTask -> ${data}`)
						await vscode.commands.executeCommand("workbench.action.files.saveFiles")
						await vscode.commands.executeCommand("workbench.action.closeWindow")
						break
				}
			})
		}
	}

	public override emit<K extends keyof CybrosysAssistaEvents>(
		eventName: K,
		...args: K extends keyof CybrosysAssistaEvents ? CybrosysAssistaEvents[K] : never
	) {
		const data = { eventName: eventName as CybrosysAssistaEventName, payload: args } as TaskEvent
		this.ipc?.broadcast({ type: IpcMessageType.TaskEvent, origin: IpcOrigin.Server, data })
		return super.emit(eventName, ...args)
	}

	public async startNewTask({
		configuration,
		text,
		images,
		newTab,
	}: {
		configuration: CybrosysAssistaSettings
		text?: string
		images?: string[]
		newTab?: boolean
	}) {
		let provider: AssistaProvider

		if (newTab) {
			await vscode.commands.executeCommand("workbench.action.files.revert")
			await vscode.commands.executeCommand("workbench.action.closeAllEditors")

			provider = await openAssistaInNewTab({ context: this.context, outputChannel: this.outputChannel })
			this.registerListeners(provider)
		} else {
			await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)

			provider = this.sidebarProvider
		}

		if (configuration) {
			await provider.setValues(configuration)

			if (configuration.allowedCommands) {
				await vscode.workspace
					.getConfiguration(Package.name)
					.update("allowedCommands", configuration.allowedCommands, vscode.ConfigurationTarget.Global)
			}
		}

		await provider.removeAssistaFromStack()
		await provider.postStateToWebview()
		await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		await provider.postMessageToWebview({ type: "invoke", invoke: "newChat", text, images })

		const assista = await provider.initAssistaWithTask(text, images, undefined, {
			consecutiveMistakeLimit: Number.MAX_SAFE_INTEGER,
		})

		if (!assista) {
			throw new Error("Failed to create task due to policy restrictions")
		}

		return assista.taskId
	}

	public async resumeTask(taskId: string): Promise<void> {
		const { historyItem } = await this.sidebarProvider.getTaskWithId(taskId)
		await this.sidebarProvider.initAssistaWithHistoryItem(historyItem)
		await this.sidebarProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}

	public async isTaskInHistory(taskId: string): Promise<boolean> {
		try {
			await this.sidebarProvider.getTaskWithId(taskId)
			return true
		} catch {
			return false
		}
	}

	public getCurrentTaskStack() {
		return this.sidebarProvider.getCurrentTaskStack()
	}

	public async clearCurrentTask(lastMessage?: string) {
		await this.sidebarProvider.finishSubTask(lastMessage ?? "")
		await this.sidebarProvider.postStateToWebview()
	}

	public async cancelCurrentTask() {
		await this.sidebarProvider.cancelTask()
	}

	public async cancelTask(taskId: string) {
		const provider = this.taskMap.get(taskId)

		if (provider) {
			await provider.cancelTask()
			this.taskMap.delete(taskId)
		}
	}

	public async sendMessage(text?: string, images?: string[]) {
		await this.sidebarProvider.postMessageToWebview({ type: "invoke", invoke: "sendMessage", text, images })
	}

	public async pressPrimaryButton() {
		await this.sidebarProvider.postMessageToWebview({ type: "invoke", invoke: "primaryButtonClick" })
	}

	public async pressSecondaryButton() {
		await this.sidebarProvider.postMessageToWebview({ type: "invoke", invoke: "secondaryButtonClick" })
	}

	public isReady() {
		return this.sidebarProvider.viewLaunched
	}

	private registerListeners(provider: AssistaProvider) {
		provider.on("assistaCreated", (assista) => {
			assista.on("taskStarted", async () => {
				this.emit(CybrosysAssistaEventName.TaskStarted, assista.taskId)
				this.taskMap.set(assista.taskId, provider)
				await this.fileLog(`[${new Date().toISOString()}] taskStarted -> ${assista.taskId}\n`)
			})

			assista.on("message", async (message) => {
				this.emit(CybrosysAssistaEventName.Message, { taskId: assista.taskId, ...message })

				if (message.message.partial !== true) {
					await this.fileLog(`[${new Date().toISOString()}] ${JSON.stringify(message.message, null, 2)}\n`)
				}
			})

			assista.on("taskModeSwitched", (taskId, mode) => this.emit(CybrosysAssistaEventName.TaskModeSwitched, taskId, mode))

			assista.on("taskAskResponded", () => this.emit(CybrosysAssistaEventName.TaskAskResponded, assista.taskId))

			assista.on("taskAborted", () => {
				this.emit(CybrosysAssistaEventName.TaskAborted, assista.taskId)
				this.taskMap.delete(assista.taskId)
			})

			assista.on("taskCompleted", async (_, tokenUsage, toolUsage) => {
				let isSubtask = false
				if (assista.rootTask != undefined) {
					isSubtask = true
				}
				this.emit(CybrosysAssistaEventName.TaskCompleted, assista.taskId, tokenUsage, toolUsage, { isSubtask: isSubtask })
				this.taskMap.delete(assista.taskId)

				await this.fileLog(
					`[${new Date().toISOString()}] taskCompleted -> ${assista.taskId} | ${JSON.stringify(tokenUsage, null, 2)} | ${JSON.stringify(toolUsage, null, 2)}\n`,
				)
			})

			assista.on("taskSpawned", (childTaskId) => this.emit(CybrosysAssistaEventName.TaskSpawned, assista.taskId, childTaskId))
			assista.on("taskPaused", () => this.emit(CybrosysAssistaEventName.TaskPaused, assista.taskId))
			assista.on("taskUnpaused", () => this.emit(CybrosysAssistaEventName.TaskUnpaused, assista.taskId))

			assista.on("taskTokenUsageUpdated", (_, usage) =>
				this.emit(CybrosysAssistaEventName.TaskTokenUsageUpdated, assista.taskId, usage),
			)

			assista.on("taskToolFailed", (taskId, tool, error) =>
				this.emit(CybrosysAssistaEventName.TaskToolFailed, taskId, tool, error),
			)

			this.emit(CybrosysAssistaEventName.TaskCreated, assista.taskId)
		})
	}

	// Logging

	private outputChannelLog(...args: unknown[]) {
		for (const arg of args) {
			if (arg === null) {
				this.outputChannel.appendLine("null")
			} else if (arg === undefined) {
				this.outputChannel.appendLine("undefined")
			} else if (typeof arg === "string") {
				this.outputChannel.appendLine(arg)
			} else if (arg instanceof Error) {
				this.outputChannel.appendLine(`Error: ${arg.message}\n${arg.stack || ""}`)
			} else {
				try {
					this.outputChannel.appendLine(
						JSON.stringify(
							arg,
							(key, value) => {
								if (typeof value === "bigint") return `BigInt(${value})`
								if (typeof value === "function") return `Function: ${value.name || "anonymous"}`
								if (typeof value === "symbol") return value.toString()
								return value
							},
							2,
						),
					)
				} catch (error) {
					this.outputChannel.appendLine(`[Non-serializable object: ${Object.prototype.toString.call(arg)}]`)
				}
			}
		}
	}

	private async fileLog(message: string) {
		if (!this.logfile) {
			return
		}

		try {
			await fs.appendFile(this.logfile, message, "utf8")
		} catch (_) {
			this.logfile = undefined
		}
	}

	// Global Settings Management

	public getConfiguration(): CybrosysAssistaSettings {
		return Object.fromEntries(
			Object.entries(this.sidebarProvider.getValues()).filter(([key]) => !isSecretStateKey(key)),
		)
	}

	public async setConfiguration(values: CybrosysAssistaSettings) {
		await this.sidebarProvider.contextProxy.setValues(values)
		await this.sidebarProvider.providerSettingsManager.saveConfig(values.currentApiConfigName || "default", values)
		await this.sidebarProvider.postStateToWebview()
	}

	// Provider Profile Management

	public getProfiles(): string[] {
		return this.sidebarProvider.getProviderProfileEntries().map(({ name }) => name)
	}

	public getProfileEntry(name: string): ProviderSettingsEntry | undefined {
		return this.sidebarProvider.getProviderProfileEntry(name)
	}

	public async createProfile(name: string, profile?: ProviderSettings, activate: boolean = true) {
		const entry = this.getProfileEntry(name)

		if (entry) {
			throw new Error(`Profile with name "${name}" already exists`)
		}

		const id = await this.sidebarProvider.upsertProviderProfile(name, profile ?? {}, activate)

		if (!id) {
			throw new Error(`Failed to create profile with name "${name}"`)
		}

		return id
	}

	public async updateProfile(
		name: string,
		profile: ProviderSettings,
		activate: boolean = true,
	): Promise<string | undefined> {
		const entry = this.getProfileEntry(name)

		if (!entry) {
			throw new Error(`Profile with name "${name}" does not exist`)
		}

		const id = await this.sidebarProvider.upsertProviderProfile(name, profile, activate)

		if (!id) {
			throw new Error(`Failed to update profile with name "${name}"`)
		}

		return id
	}

	public async upsertProfile(
		name: string,
		profile: ProviderSettings,
		activate: boolean = true,
	): Promise<string | undefined> {
		const id = await this.sidebarProvider.upsertProviderProfile(name, profile, activate)

		if (!id) {
			throw new Error(`Failed to upsert profile with name "${name}"`)
		}

		return id
	}

	public async deleteProfile(name: string): Promise<void> {
		const entry = this.getProfileEntry(name)

		if (!entry) {
			throw new Error(`Profile with name "${name}" does not exist`)
		}

		await this.sidebarProvider.deleteProviderProfile(entry)
	}

	public getActiveProfile(): string | undefined {
		return this.getConfiguration().currentApiConfigName
	}

	public async setActiveProfile(name: string): Promise<string | undefined> {
		const entry = this.getProfileEntry(name)

		if (!entry) {
			throw new Error(`Profile with name "${name}" does not exist`)
		}

		await this.sidebarProvider.activateProviderProfile({ name })
		return this.getActiveProfile()
	}
}
