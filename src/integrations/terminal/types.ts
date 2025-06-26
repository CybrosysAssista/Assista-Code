import EventEmitter from "events"

export type AssistaTerminalProvider = "vscode" | "execa"

export interface AssistaTerminal {
	provider: AssistaTerminalProvider
	id: number
	busy: boolean
	running: boolean
	taskId?: string
	process?: AssistaTerminalProcess
	getCurrentWorkingDirectory(): string
	isClosed: () => boolean
	runCommand: (command: string, callbacks: AssistaTerminalCallbacks) => AssistaTerminalProcessResultPromise
	setActiveStream(stream: AsyncIterable<string> | undefined, pid?: number): void
	shellExecutionComplete(exitDetails: ExitCodeDetails): void
	getProcessesWithOutput(): AssistaTerminalProcess[]
	getUnretrievedOutput(): string
	getLastCommand(): string
	cleanCompletedProcessQueue(): void
}

export interface AssistaTerminalCallbacks {
	onLine: (line: string, process: AssistaTerminalProcess) => void
	onCompleted: (output: string | undefined, process: AssistaTerminalProcess) => void
	onShellExecutionStarted: (pid: number | undefined, process: AssistaTerminalProcess) => void
	onShellExecutionComplete: (details: ExitCodeDetails, process: AssistaTerminalProcess) => void
	onNoShellIntegration?: (message: string, process: AssistaTerminalProcess) => void
}

export interface AssistaTerminalProcess extends EventEmitter<AssistaTerminalProcessEvents> {
	command: string
	isHot: boolean
	run: (command: string) => Promise<void>
	continue: () => void
	abort: () => void
	hasUnretrievedOutput: () => boolean
	getUnretrievedOutput: () => string
}

export type AssistaTerminalProcessResultPromise = AssistaTerminalProcess & Promise<void>

export interface AssistaTerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: [output?: string]
	stream_available: [stream: AsyncIterable<string>]
	shell_execution_started: [pid: number | undefined]
	shell_execution_complete: [exitDetails: ExitCodeDetails]
	error: [error: Error]
	no_shell_integration: [message: string]
}

export interface ExitCodeDetails {
	exitCode: number | undefined
	signal?: number | undefined
	signalName?: string
	coreDumpPossible?: boolean
}
