import Anthropic from "@anthropic-ai/sdk"

import { Task } from "../task/Task"
import {
	ToolResponse,
	ToolUse,
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
	ToolDescription,
	AskFinishSubTaskApproval,
} from "../../shared/tools"
import { formatResponse } from "../prompts/responses"

export async function attemptCompletionTool(
	assista: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
	toolDescription: ToolDescription,
	askFinishSubTaskApproval: AskFinishSubTaskApproval,
) {
	const result: string | undefined = block.params.result
	const command: string | undefined = block.params.command

	try {
		const lastMessage = assista.assistaMessages.at(-1)

		if (block.partial) {
			if (command) {
				// the attempt_completion text is done, now we're getting command
				// remove the previous partial attempt_completion ask, replace with say, post state to webview, then stream command

				// const secondLastMessage = assista.assistaMessages.at(-2)
				if (lastMessage && lastMessage.ask === "command") {
					// update command
					await assista.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				} else {
					// last message is completion_result
					// we have command string, which means we have the result as well, so finish it (doesnt have to exist yet)
					await assista.say("completion_result", removeClosingTag("result", result), undefined, false)

					assista.emit("taskCompleted", assista.taskId, assista.getTokenUsage(), assista.toolUsage)

					await assista.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				}
			} else {
				// no command, still outputting partial result
				await assista.say("completion_result", removeClosingTag("result", result), undefined, block.partial)
			}
			return
		} else {
			if (!result) {
				assista.consecutiveMistakeCount++
				assista.recordToolError("attempt_completion")
				pushToolResult(await assista.sayAndCreateMissingParamError("attempt_completion", "result"))
				return
			}

			assista.consecutiveMistakeCount = 0

			// Command execution is permanently disabled in attempt_completion
			// Users must use execute_command tool separately before attempt_completion
			await assista.say("completion_result", result, undefined, false)
			assista.emit("taskCompleted", assista.taskId, assista.getTokenUsage(), assista.toolUsage)

			if (assista.parentTask) {
				const didApprove = await askFinishSubTaskApproval()

				if (!didApprove) {
					return
				}

				// tell the provider to remove the current subtask and resume the previous task in the stack
				await assista.providerRef.deref()?.finishSubTask(result)
				return
			}

			// We already sent completion_result says, an
			// empty string asks relinquishes control over
			// button and field.
			const { response, text, images } = await assista.ask("completion_result", "", false)

			// Signals to recursive loop to stop (for now
			// assista never happens since yesButtonClicked
			// will trigger a new task).
			if (response === "yesButtonClicked") {
				pushToolResult("")
				return
			}

			await assista.say("user_feedback", text ?? "", images)
			const toolResults: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []

			toolResults.push({
				type: "text",
				text: `The user has provided feedback on the results. Consider their input to continue the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
			})

			toolResults.push(...formatResponse.imageBlocks(images))
			assista.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })
			assista.userMessageContent.push(...toolResults)

			return
		}
	} catch (error) {
		await handleError("inspecting site", error)
		return
	}
}
