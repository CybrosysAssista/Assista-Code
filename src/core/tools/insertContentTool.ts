import delay from "delay"
import fs from "fs/promises"
import path from "path"

import { getReadablePath } from "../../utils/path"
import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { AssistaSayTool } from "../../shared/ExtensionMessage"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../utils/fs"
import { insertGroups } from "../diff/insert-groups"

export async function insertContentTool(
	assista: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	const line: string | undefined = block.params.line
	const content: string | undefined = block.params.content

	const sharedMessageProps: AssistaSayTool = {
		tool: "insertContent",
		path: getReadablePath(assista.cwd, removeClosingTag("path", relPath)),
		diff: content,
		lineNumber: line ? parseInt(line, 10) : undefined,
	}

	try {
		if (block.partial) {
			await assista.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
			return
		}

		// Validate required parameters
		if (!relPath) {
			assista.consecutiveMistakeCount++
			assista.recordToolError("insert_content")
			pushToolResult(await assista.sayAndCreateMissingParamError("insert_content", "path"))
			return
		}

		if (!line) {
			assista.consecutiveMistakeCount++
			assista.recordToolError("insert_content")
			pushToolResult(await assista.sayAndCreateMissingParamError("insert_content", "line"))
			return
		}

		if (!content) {
			assista.consecutiveMistakeCount++
			assista.recordToolError("insert_content")
			pushToolResult(await assista.sayAndCreateMissingParamError("insert_content", "content"))
			return
		}

		const accessAllowed = assista.assistaIgnoreController?.validateAccess(relPath)

		if (!accessAllowed) {
			await assista.say("assistaignore_error", relPath)
			pushToolResult(formatResponse.toolError(formatResponse.assistaIgnoreError(relPath)))
			return
		}

		// Check if file is write-protected
		const isWriteProtected = assista.assistaProtectedController?.isWriteProtected(relPath) || false

		const absolutePath = path.resolve(assista.cwd, relPath)
		const fileExists = await fileExistsAtPath(absolutePath)

		if (!fileExists) {
			assista.consecutiveMistakeCount++
			assista.recordToolError("insert_content")
			const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
			await assista.say("error", formattedError)
			pushToolResult(formattedError)
			return
		}

		const lineNumber = parseInt(line, 10)
		if (isNaN(lineNumber) || lineNumber < 0) {
			assista.consecutiveMistakeCount++
			assista.recordToolError("insert_content")
			pushToolResult(formatResponse.toolError("Invalid line number. Must be a non-negative integer."))
			return
		}

		assista.consecutiveMistakeCount = 0

		// Read the file
		const fileContent = await fs.readFile(absolutePath, "utf8")
		assista.diffViewProvider.editType = "modify"
		assista.diffViewProvider.originalContent = fileContent
		const lines = fileContent.split("\n")

		const updatedContent = insertGroups(lines, [
			{
				index: lineNumber - 1,
				elements: content.split("\n"),
			},
		]).join("\n")

		// Show changes in diff view
		if (!assista.diffViewProvider.isEditing) {
			await assista.ask("tool", JSON.stringify(sharedMessageProps), true).catch(() => {})
			// First open with original content
			await assista.diffViewProvider.open(relPath)
			await assista.diffViewProvider.update(fileContent, false)
			assista.diffViewProvider.scrollToFirstDiff()
			await delay(200)
		}

		const diff = formatResponse.createPrettyPatch(relPath, fileContent, updatedContent)

		if (!diff) {
			pushToolResult(`No changes needed for '${relPath}'`)
			return
		}

		await assista.diffViewProvider.update(updatedContent, true)

		const completeMessage = JSON.stringify({
			...sharedMessageProps,
			diff,
			lineNumber: lineNumber,
			isProtected: isWriteProtected,
		} satisfies AssistaSayTool)

		const didApprove = await assista
			.ask("tool", completeMessage, isWriteProtected)
			.then((response) => response.response === "yesButtonClicked")

		if (!didApprove) {
			await assista.diffViewProvider.revertChanges()
			pushToolResult("Changes were rejected by the user.")
			return
		}

		// Call saveChanges to update the DiffViewProvider properties
		await assista.diffViewProvider.saveChanges()

		// Track file edit operation
		if (relPath) {
			await assista.fileContextTracker.trackFileContext(relPath, "assista_edited" as RecordSource)
		}

		assista.didEditFile = true

		// Get the formatted response message
		const message = await assista.diffViewProvider.pushToolWriteResult(
			assista,
			assista.cwd,
			false, // Always false for insert_content
		)

		pushToolResult(message)

		await assista.diffViewProvider.reset()
	} catch (error) {
		handleError("insert content", error)
		await assista.diffViewProvider.reset()
	}
}
