import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { parseXml } from "../../utils/xml"

export async function askFollowupQuestionTool(
	assista: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const question: string | undefined = block.params.question
	const follow_up: string | undefined = block.params.follow_up

	try {
		if (block.partial) {
			await assista.ask("followup", removeClosingTag("question", question), block.partial).catch(() => {})
			return
		} else {
			if (!question) {
				assista.consecutiveMistakeCount++
				assista.recordToolError("ask_followup_question")
				pushToolResult(await assista.sayAndCreateMissingParamError("ask_followup_question", "question"))
				return
			}

			type Suggest = { answer: string }

			let follow_up_json = {
				question,
				suggest: [] as Suggest[],
			}

			if (follow_up) {
				let parsedSuggest: {
					suggest: Suggest[] | Suggest
				}

				try {
					parsedSuggest = parseXml(follow_up, ["suggest"]) as { suggest: Suggest[] | Suggest }
				} catch (error) {
					assista.consecutiveMistakeCount++
					assista.recordToolError("ask_followup_question")
					await assista.say("error", `Failed to parse operations: ${error.message}`)
					pushToolResult(formatResponse.toolError("Invalid operations xml format"))
					return
				}

				const normalizedSuggest = Array.isArray(parsedSuggest?.suggest)
					? parsedSuggest.suggest
					: [parsedSuggest?.suggest].filter((sug): sug is Suggest => sug !== undefined)

				follow_up_json.suggest = normalizedSuggest
			}

			assista.consecutiveMistakeCount = 0
			const { text, images } = await assista.ask("followup", JSON.stringify(follow_up_json), false)
			await assista.say("user_feedback", text ?? "", images)
			pushToolResult(formatResponse.toolResult(`<answer>\n${text}\n</answer>`, images))

			return
		}
	} catch (error) {
		await handleError("asking question", error)
		return
	}
}
