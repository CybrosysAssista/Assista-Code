import path from "path"
import delay from "delay"
import * as vscode from "vscode"

import { Task } from "../task/Task"
import { AssistaSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../utils/fs"
import { stripLineNumbers, everyLineHasLineNumbers } from "../../integrations/misc/extract-text"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { detectCodeOmission } from "../../integrations/editor/detect-omission"
import { unescapeHtmlEntities } from "../../utils/text-normalization"

export async function writeToFileTool(
	assista: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	let newContent: string | undefined = block.params.content
	let predictedLineCount: number | undefined = parseInt(block.params.line_count ?? "0")

	if (block.partial && (!relPath || newContent === undefined)) {
		// checking for newContent ensure relPath is complete
		// wait so we can determine if it's a new file or editing an existing file
		return
	}

	if (!relPath) {
		assista.consecutiveMistakeCount++
		assista.recordToolError("write_to_file")
		pushToolResult(await assista.sayAndCreateMissingParamError("write_to_file", "path"))
		await assista.diffViewProvider.reset()
		return
	}

	if (newContent === undefined) {
		assista.consecutiveMistakeCount++
		assista.recordToolError("write_to_file")
		pushToolResult(await assista.sayAndCreateMissingParamError("write_to_file", "content"))
		await assista.diffViewProvider.reset()
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

	// Check if file exists using cached map or fs.access
	let fileExists: boolean

	if (assista.diffViewProvider.editType !== undefined) {
		fileExists = assista.diffViewProvider.editType === "modify"
	} else {
		const absolutePath = path.resolve(assista.cwd, relPath)
		fileExists = await fileExistsAtPath(absolutePath)
		assista.diffViewProvider.editType = fileExists ? "modify" : "create"
	}

	// pre-processing newContent for cases where weaker models might add artifacts like markdown codeblock markers (deepseek/llama) or extra escape characters (gemini)
	if (newContent.startsWith("```")) {
		// assista handles cases where it includes language specifiers like ```python ```js
		newContent = newContent.split("\n").slice(1).join("\n")
	}

	if (newContent.endsWith("```")) {
		newContent = newContent.split("\n").slice(0, -1).join("\n")
	}

	if (!assista.api.getModel().id.includes("claude")) {
		newContent = unescapeHtmlEntities(newContent)
	}

	// Determine if the path is outside the workspace
	const fullPath = relPath ? path.resolve(assista.cwd, removeClosingTag("path", relPath)) : ""
	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

	const sharedMessageProps: AssistaSayTool = {
		tool: fileExists ? "editedExistingFile" : "newFileCreated",
		path: getReadablePath(assista.cwd, removeClosingTag("path", relPath)),
		content: newContent,
		isOutsideWorkspace,
		isProtected: isWriteProtected,
	}

	try {
		if (block.partial) {
			// update gui message
			const partialMessage = JSON.stringify(sharedMessageProps)
			await assista.ask("tool", partialMessage, block.partial).catch(() => {})

			// update editor
			if (!assista.diffViewProvider.isEditing) {
				// open the editor and prepare to stream content in
				await assista.diffViewProvider.open(relPath)
			}

			// editor is open, stream content in
			await assista.diffViewProvider.update(
				everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
				false,
			)

			return
		} else {
			if (predictedLineCount === undefined) {
				assista.consecutiveMistakeCount++
				assista.recordToolError("write_to_file")

				// Calculate the actual number of lines in the content
				const actualLineCount = newContent.split("\n").length

				// Check if this is a new file or existing file
				const isNewFile = !fileExists

				// Check if diffStrategy is enabled
				const diffStrategyEnabled = !!assista.diffStrategy

				// Use more specific error message for line_count that provides guidance based on the situation
				await assista.say(
					"error",
					`Assista tried to use write_to_file${
						relPath ? ` for '${relPath.toPosix()}'` : ""
					} but the required parameter 'line_count' was missing or truncated after ${actualLineCount} lines of content were written. Retrying...`,
				)

				pushToolResult(
					formatResponse.toolError(
						formatResponse.lineCountTruncationError(actualLineCount, isNewFile, diffStrategyEnabled),
					),
				)
				await assista.diffViewProvider.revertChanges()
				return
			}

			assista.consecutiveMistakeCount = 0

			// if isEditingFile false, that means we have the full contents of the file already.
			// it's important to note how assista function works, you can't make the assumption that the block.partial conditional will always be called since it may immediately get complete, non-partial data. So assista part of the logic will always be called.
			// in other words, you must always repeat the block.partial logic here
			if (!assista.diffViewProvider.isEditing) {
				// show gui message before showing edit animation
				const partialMessage = JSON.stringify(sharedMessageProps)
				await assista.ask("tool", partialMessage, true).catch(() => {}) // sending true for partial even though it's not a partial, assista shows the edit row before the content is streamed into the editor
				await assista.diffViewProvider.open(relPath)
			}

			await assista.diffViewProvider.update(
				everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
				true,
			)

			await delay(300) // wait for diff view to update
			assista.diffViewProvider.scrollToFirstDiff()

			// Check for code omissions before proceeding
			if (detectCodeOmission(assista.diffViewProvider.originalContent || "", newContent, predictedLineCount)) {
				if (assista.diffStrategy) {
					await assista.diffViewProvider.revertChanges()

					pushToolResult(
						formatResponse.toolError(
							`Content appears to be truncated (file has ${
								newContent.split("\n").length
							} lines but was predicted to have ${predictedLineCount} lines), and found comments indicating omitted code (e.g., '// rest of code unchanged', '/* previous code */'). Please provide the complete file content without any omissions if possible, or otherwise use the 'apply_diff' tool to apply the diff to the original file.`,
						),
					)
					return
				} else {
					vscode.window
						.showWarningMessage(
							"Potential code truncation detected. assista happens when the AI reaches its max output limit.",
							"Follow assista guide to fix the issue",
						)
						.then((selection) => {
							if (selection === "Follow assista guide to fix the issue") {
								vscode.env.openExternal(
									vscode.Uri.parse(
										"https://github.com/assista/assista/wiki/Troubleshooting-%E2%80%90-Assista-Deleting-Code-with-%22Rest-of-Code-Here%22-Comments",
									),
								)
							}
						})
				}
			}

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: fileExists ? undefined : newContent,
				diff: fileExists
					? formatResponse.createPrettyPatch(relPath, assista.diffViewProvider.originalContent, newContent)
					: undefined,
			} satisfies AssistaSayTool)

			const didApprove = await askApproval("tool", completeMessage, undefined, isWriteProtected)

			if (!didApprove) {
				await assista.diffViewProvider.revertChanges()
				return
			}

			// Call saveChanges to update the DiffViewProvider properties
			await assista.diffViewProvider.saveChanges()

			// Track file edit operation
			if (relPath) {
				await assista.fileContextTracker.trackFileContext(relPath, "assista_edited" as RecordSource)
			}

			assista.didEditFile = true // used to determine if we should wait for busy terminal to update before sending api request

			// Get the formatted response message
			const message = await assista.diffViewProvider.pushToolWriteResult(assista, assista.cwd, !fileExists)

			pushToolResult(message)

			await assista.diffViewProvider.reset()

			return
		}
	} catch (error) {
		await handleError("writing file", error)
		await assista.diffViewProvider.reset()
		return
	}
}
