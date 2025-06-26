import path from "path"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { AssistaSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { regexSearchFiles } from "../../services/ripgrep"

export async function searchFilesTool(
	assista: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relDirPath: string | undefined = block.params.path
	const regex: string | undefined = block.params.regex
	const filePattern: string | undefined = block.params.file_pattern

	const absolutePath = relDirPath ? path.resolve(assista.cwd, relDirPath) : assista.cwd
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	const sharedMessageProps: AssistaSayTool = {
		tool: "searchFiles",
		path: getReadablePath(assista.cwd, removeClosingTag("path", relDirPath)),
		regex: removeClosingTag("regex", regex),
		filePattern: removeClosingTag("file_pattern", filePattern),
		isOutsideWorkspace,
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies AssistaSayTool)
			await assista.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!relDirPath) {
				assista.consecutiveMistakeCount++
				assista.recordToolError("search_files")
				pushToolResult(await assista.sayAndCreateMissingParamError("search_files", "path"))
				return
			}

			if (!regex) {
				assista.consecutiveMistakeCount++
				assista.recordToolError("search_files")
				pushToolResult(await assista.sayAndCreateMissingParamError("search_files", "regex"))
				return
			}

			assista.consecutiveMistakeCount = 0

			const results = await regexSearchFiles(
				assista.cwd,
				absolutePath,
				regex,
				filePattern,
				assista.assistaIgnoreController,
			)

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: results } satisfies AssistaSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(results)

			return
		}
	} catch (error) {
		await handleError("searching files", error)
		return
	}
}
