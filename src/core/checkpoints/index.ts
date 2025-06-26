import pWaitFor from "p-wait-for"
import * as vscode from "vscode"

import { Task } from "../task/Task"

import { getWorkspacePath } from "../../utils/path"

import { AssistaApiReqInfo } from "../../shared/ExtensionMessage"
import { getApiMetrics } from "../../shared/getApiMetrics"

import { DIFF_VIEW_URI_SCHEME } from "../../integrations/editor/DiffViewProvider"

import { CheckpointServiceOptions, RepoPerTaskCheckpointService } from "../../services/checkpoints"

export function getCheckpointService(assista: Task) {
	if (!assista.enableCheckpoints) {
		return undefined
	}

	if (assista.checkpointService) {
		return assista.checkpointService
	}

	if (assista.checkpointServiceInitializing) {
		console.log("[Task#getCheckpointService] checkpoint service is still initializing")
		return undefined
	}

	const provider = assista.providerRef.deref()

	const log = (message: string) => {
		console.log(message)

		try {
			provider?.log(message)
		} catch (err) {
			// NO-OP
		}
	}

	console.log("[Task#getCheckpointService] initializing checkpoints service")

	try {
		const workspaceDir = getWorkspacePath()

		if (!workspaceDir) {
			log("[Task#getCheckpointService] workspace folder not found, disabling checkpoints")
			assista.enableCheckpoints = false
			return undefined
		}

		const globalStorageDir = provider?.context.globalStorageUri.fsPath

		if (!globalStorageDir) {
			log("[Task#getCheckpointService] globalStorageDir not found, disabling checkpoints")
			assista.enableCheckpoints = false
			return undefined
		}

		const options: CheckpointServiceOptions = {
			taskId: assista.taskId,
			workspaceDir,
			shadowDir: globalStorageDir,
			log,
		}

		const service = RepoPerTaskCheckpointService.create(options)

		assista.checkpointServiceInitializing = true

		service.on("initialize", () => {
			log("[Task#getCheckpointService] service initialized")

			try {
				const isCheckpointNeeded =
					typeof assista.assistaMessages.find(({ say }) => say === "checkpoint_saved") === "undefined"

				assista.checkpointService = service
				assista.checkpointServiceInitializing = false

				if (isCheckpointNeeded) {
					log("[Task#getCheckpointService] no checkpoints found, saving initial checkpoint")
					checkpointSave(assista)
				}
			} catch (err) {
				log("[Task#getCheckpointService] caught error in on('initialize'), disabling checkpoints")
				assista.enableCheckpoints = false
			}
		})

		service.on("checkpoint", ({ isFirst, fromHash: from, toHash: to }) => {
			try {
				provider?.postMessageToWebview({ type: "currentCheckpointUpdated", text: to })

				assista
					.say("checkpoint_saved", to, undefined, undefined, { isFirst, from, to }, undefined, {
						isNonInteractive: true,
					})
					.catch((err) => {
						log("[Task#getCheckpointService] caught unexpected error in say('checkpoint_saved')")
						console.error(err)
					})
			} catch (err) {
				log("[Task#getCheckpointService] caught unexpected error in on('checkpoint'), disabling checkpoints")
				console.error(err)
				assista.enableCheckpoints = false
			}
		})

		log("[Task#getCheckpointService] initializing shadow git")

		service.initShadowGit().catch((err) => {
			log(`[Task#getCheckpointService] initShadowGit -> ${err.message}`)
			assista.enableCheckpoints = false
		})

		return service
	} catch (err) {
		log(`[Task#getCheckpointService] ${err.message}`)
		assista.enableCheckpoints = false
		return undefined
	}
}

async function getInitializedCheckpointService(
	assista: Task,
	{ interval = 250, timeout = 15_000 }: { interval?: number; timeout?: number } = {},
) {
	const service = getCheckpointService(assista)

	if (!service || service.isInitialized) {
		return service
	}

	try {
		await pWaitFor(
			() => {
				console.log("[Task#getCheckpointService] waiting for service to initialize")
				return service.isInitialized
			},
			{ interval, timeout },
		)

		return service
	} catch (err) {
		return undefined
	}
}

export async function checkpointSave(assista: Task, force = false) {
	const service = getCheckpointService(assista)

	if (!service) {
		return
	}

	if (!service.isInitialized) {
		const provider = assista.providerRef.deref()
		provider?.log("[checkpointSave] checkpoints didn't initialize in time, disabling checkpoints for this task")
		assista.enableCheckpoints = false
		return
	}

	console.log("[Task#checkpointSave] starting checkpoint save process")

	// Start the checkpoint process in the background.
	return service.saveCheckpoint(`Task: ${assista.taskId}, Time: ${Date.now()}`, { allowEmpty: force }).catch((err) => {
		console.error("[Task#checkpointSave] caught unexpected error, disabling checkpoints", err)
		assista.enableCheckpoints = false
	})
}

export type CheckpointRestoreOptions = {
	ts: number
	commitHash: string
	mode: "preview" | "restore"
}

export async function checkpointRestore(assista: Task, { ts, commitHash, mode }: CheckpointRestoreOptions) {
	const service = await getInitializedCheckpointService(assista)

	if (!service) {
		return
	}

	const index = assista.assistaMessages.findIndex((m) => m.ts === ts)

	if (index === -1) {
		return
	}

	const provider = assista.providerRef.deref()

	try {
		await service.restoreCheckpoint(commitHash)
		await provider?.postMessageToWebview({ type: "currentCheckpointUpdated", text: commitHash })

		if (mode === "restore") {
			await assista.overwriteApiConversationHistory(assista.apiConversationHistory.filter((m) => !m.ts || m.ts < ts))

			const deletedMessages = assista.assistaMessages.slice(index + 1)

			const { totalTokensIn, totalTokensOut, totalCacheWrites, totalCacheReads, totalCost } = getApiMetrics(
				assista.combineMessages(deletedMessages),
			)

			await assista.overwriteAssistaMessages(assista.assistaMessages.slice(0, index + 1))

			// TODO: Verify that this is working as expected.
			await assista.say(
				"api_req_deleted",
				JSON.stringify({
					tokensIn: totalTokensIn,
					tokensOut: totalTokensOut,
					cacheWrites: totalCacheWrites,
					cacheReads: totalCacheReads,
					cost: totalCost,
				} satisfies AssistaApiReqInfo),
			)
		}

		// The task is already cancelled by the provider beforehand, but we
		// need to re-init to get the updated messages.
		//
		// This was take from Assista's implementation of the checkpoints
		// feature. The assista instance will hang if we don't cancel twice,
		// so this is currently necessary, but it seems like a complicated
		// and hacky solution to a problem that I don't fully understand.
		// I'd like to revisit this in the future and try to improve the
		// task flow and the communication between the webview and the
		// Assista instance.
		provider?.cancelTask()
	} catch (err) {
		provider?.log("[checkpointRestore] disabling checkpoints for this task")
		assista.enableCheckpoints = false
	}
}

export type CheckpointDiffOptions = {
	ts: number
	previousCommitHash?: string
	commitHash: string
	mode: "full" | "checkpoint"
}

export async function checkpointDiff(assista: Task, { ts, previousCommitHash, commitHash, mode }: CheckpointDiffOptions) {
	const service = await getInitializedCheckpointService(assista)

	if (!service) {
		return
	}

	if (!previousCommitHash && mode === "checkpoint") {
		const previousCheckpoint = assista.assistaMessages
			.filter(({ say }) => say === "checkpoint_saved")
			.sort((a, b) => b.ts - a.ts)
			.find((message) => message.ts < ts)

		previousCommitHash = previousCheckpoint?.text
	}

	try {
		const changes = await service.getDiff({ from: previousCommitHash, to: commitHash })

		if (!changes?.length) {
			vscode.window.showInformationMessage("No changes found.")
			return
		}

		await vscode.commands.executeCommand(
			"vscode.changes",
			mode === "full" ? "Changes since task started" : "Changes since previous checkpoint",
			changes.map((change) => [
				vscode.Uri.file(change.paths.absolute),
				vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${change.paths.relative}`).with({
					query: Buffer.from(change.content.before ?? "").toString("base64"),
				}),
				vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${change.paths.relative}`).with({
					query: Buffer.from(change.content.after ?? "").toString("base64"),
				}),
			]),
		)
	} catch (err) {
		const provider = assista.providerRef.deref()
		provider?.log("[checkpointDiff] disabling checkpoints for this task")
		assista.enableCheckpoints = false
	}
}
