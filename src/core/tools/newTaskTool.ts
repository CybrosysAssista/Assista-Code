import delay from "delay"

import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { Task } from "../task/Task"
import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"

export async function newTaskTool(
	assista: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const mode: string | undefined = block.params.mode
	const message: string | undefined = block.params.message

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "newTask",
				mode: removeClosingTag("mode", mode),
				message: removeClosingTag("message", message),
			})

			await assista.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!mode) {
				assista.consecutiveMistakeCount++
				assista.recordToolError("new_task")
				pushToolResult(await assista.sayAndCreateMissingParamError("new_task", "mode"))
				return
			}

			if (!message) {
				assista.consecutiveMistakeCount++
				assista.recordToolError("new_task")
				pushToolResult(await assista.sayAndCreateMissingParamError("new_task", "message"))
				return
			}

			assista.consecutiveMistakeCount = 0
			// Un-escape one level of backslashes before '@' for hierarchical subtasks
			// Un-escape one level: \\@ -> \@ (removes one backslash for hierarchical subtasks)
			const unescapedMessage = message.replace(/\\\\@/g, "\\@")

			// Verify the mode exists
			const targetMode = getModeBySlug(mode, (await assista.providerRef.deref()?.getState())?.customModes)

			if (!targetMode) {
				pushToolResult(formatResponse.toolError(`Invalid mode: ${mode}`))
				return
			}

			const toolMessage = JSON.stringify({
				tool: "newTask",
				mode: targetMode.name,
				content: message,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			const provider = assista.providerRef.deref()

			if (!provider) {
				return
			}

			if (assista.enableCheckpoints) {
				assista.checkpointSave(true)
			}

			// Preserve the current mode so we can resume with it later.
			assista.pausedModeSlug = (await provider.getState()).mode ?? defaultModeSlug

			// Switch mode first, then create new task instance.
			await provider.handleModeSwitch(mode)

			// Delay to allow mode change to take effect before next tool is executed.
			await delay(500)

			const newAssista = await provider.initAssistaWithTask(unescapedMessage, undefined, assista)
			if (!newAssista) {
				pushToolResult(t("tools:newTask.errors.policy_restriction"))
				return
			}
			assista.emit("taskSpawned", newAssista.taskId)

			pushToolResult(`Successfully created new task in ${targetMode.name} mode with message: ${unescapedMessage}`)

			// Set the isPaused flag to true so the parent
			// task can wait for the sub-task to finish.
			assista.isPaused = true
			assista.emit("taskPaused")

			return
		}
	} catch (error) {
		await handleError("creating new task", error)
		return
	}
}
