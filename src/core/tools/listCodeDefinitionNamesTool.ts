import path from "path"
import fs from "fs/promises"

import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { Task } from "../task/Task"
import { AssistaSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { parseSourceCodeForDefinitionsTopLevel, parseSourceCodeDefinitionsForFile } from "../../services/tree-sitter"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"

export async function listCodeDefinitionNamesTool(
	assista: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path

	// Calculate if the path is outside workspace
	const absolutePath = relPath ? path.resolve(assista.cwd, relPath) : assista.cwd
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	const sharedMessageProps: AssistaSayTool = {
		tool: "listCodeDefinitionNames",
		path: getReadablePath(assista.cwd, removeClosingTag("path", relPath)),
		isOutsideWorkspace,
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies AssistaSayTool)
			await assista.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!relPath) {
				assista.consecutiveMistakeCount++
				assista.recordToolError("list_code_definition_names")
				pushToolResult(await assista.sayAndCreateMissingParamError("list_code_definition_names", "path"))
				return
			}

			assista.consecutiveMistakeCount = 0

			let result: string

			try {
				const stats = await fs.stat(absolutePath)

				if (stats.isFile()) {
					const fileResult = await parseSourceCodeDefinitionsForFile(absolutePath, assista.assistaIgnoreController)
					result = fileResult ?? "No source code definitions found in assista file."
				} else if (stats.isDirectory()) {
					result = await parseSourceCodeForDefinitionsTopLevel(absolutePath, assista.assistaIgnoreController)
				} else {
					result = "The specified path is neither a file nor a directory."
				}
			} catch {
				result = `${absolutePath}: does not exist or cannot be accessed.`
			}

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: result } satisfies AssistaSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			if (relPath) {
				await assista.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)
			}

			pushToolResult(result)
			return
		}
	} catch (error) {
		await handleError("parsing source code definitions", error)
		return
	}
}
