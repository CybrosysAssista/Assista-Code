import path from "path"
import fs from "fs/promises"

import { AssistaSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { Task } from "../task/Task"
import { ToolUse, RemoveClosingTag, AskApproval, HandleError, PushToolResult } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { fileExistsAtPath } from "../../utils/fs"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { unescapeHtmlEntities } from "../../utils/text-normalization"

export async function applyDiffToolLegacy(
	assista: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	let diffContent: string | undefined = block.params.diff

	if (diffContent && !assista.api.getModel().id.includes("claude")) {
		diffContent = unescapeHtmlEntities(diffContent)
	}

	const sharedMessageProps: AssistaSayTool = {
		tool: "appliedDiff",
		path: getReadablePath(assista.cwd, removeClosingTag("path", relPath)),
		diff: diffContent,
	}

	try {
		if (block.partial) {
			// Update GUI message
			let toolProgressStatus

			if (assista.diffStrategy && assista.diffStrategy.getProgressStatus) {
				toolProgressStatus = assista.diffStrategy.getProgressStatus(block)
			}

			if (toolProgressStatus && Object.keys(toolProgressStatus).length === 0) {
				return
			}

			await assista
				.ask("tool", JSON.stringify(sharedMessageProps), block.partial, toolProgressStatus)
				.catch(() => {})

			return
		} else {
			if (!relPath) {
				assista.consecutiveMistakeCount++
				assista.recordToolError("apply_diff")
				pushToolResult(await assista.sayAndCreateMissingParamError("apply_diff", "path"))
				return
			}

			if (!diffContent) {
				assista.consecutiveMistakeCount++
				assista.recordToolError("apply_diff")
				pushToolResult(await assista.sayAndCreateMissingParamError("apply_diff", "diff"))
				return
			}

			const accessAllowed = assista.assistaIgnoreController?.validateAccess(relPath)

			if (!accessAllowed) {
				await assista.say("assistaignore_error", relPath)
				pushToolResult(formatResponse.toolError(formatResponse.assistaIgnoreError(relPath)))
				return
			}

			const absolutePath = path.resolve(assista.cwd, relPath)
			const fileExists = await fileExistsAtPath(absolutePath)

			if (!fileExists) {
				assista.consecutiveMistakeCount++
				assista.recordToolError("apply_diff")
				const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
				await assista.say("error", formattedError)
				pushToolResult(formattedError)
				return
			}

			let originalContent: string | null = await fs.readFile(absolutePath, "utf-8")

			// Apply the diff to the original content
			const diffResult = (await assista.diffStrategy?.applyDiff(
				originalContent,
				diffContent,
				parseInt(block.params.start_line ?? ""),
			)) ?? {
				success: false,
				error: "No diff strategy available",
			}

			// Release the original content from memory as it's no longer needed
			originalContent = null

			if (!diffResult.success) {
				assista.consecutiveMistakeCount++
				const currentCount = (assista.consecutiveMistakeCountForApplyDiff.get(relPath) || 0) + 1
				assista.consecutiveMistakeCountForApplyDiff.set(relPath, currentCount)
				let formattedError = ""

				if (diffResult.failParts && diffResult.failParts.length > 0) {
					for (const failPart of diffResult.failParts) {
						if (failPart.success) {
							continue
						}

						const errorDetails = failPart.details ? JSON.stringify(failPart.details, null, 2) : ""

						formattedError = `<error_details>\n${
							failPart.error
						}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n</error_details>`
					}
				} else {
					const errorDetails = diffResult.details ? JSON.stringify(diffResult.details, null, 2) : ""

					formattedError = `Unable to apply diff to file: ${absolutePath}\n\n<error_details>\n${
						diffResult.error
					}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ""}\n</error_details>`
				}

				if (currentCount >= 2) {
					await assista.say("diff_error", formattedError)
				}

				assista.recordToolError("apply_diff", formattedError)

				pushToolResult(formattedError)
				return
			}

			assista.consecutiveMistakeCount = 0
			assista.consecutiveMistakeCountForApplyDiff.delete(relPath)

			// Show diff view before asking for approval
			assista.diffViewProvider.editType = "modify"
			await assista.diffViewProvider.open(relPath)
			await assista.diffViewProvider.update(diffResult.content, true)
			await assista.diffViewProvider.scrollToFirstDiff()

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				diff: diffContent,
			} satisfies AssistaSayTool)

			let toolProgressStatus

			if (assista.diffStrategy && assista.diffStrategy.getProgressStatus) {
				toolProgressStatus = assista.diffStrategy.getProgressStatus(block, diffResult)
			}

			const didApprove = await askApproval("tool", completeMessage, toolProgressStatus)

			if (!didApprove) {
				await assista.diffViewProvider.revertChanges() // Assista likely handles closing the diff view
				return
			}

			// Call saveChanges to update the DiffViewProvider properties
			await assista.diffViewProvider.saveChanges()

			// Track file edit operation
			if (relPath) {
				await assista.fileContextTracker.trackFileContext(relPath, "assista_edited" as RecordSource)
			}

			// Used to determine if we should wait for busy terminal to update before sending api request
			assista.didEditFile = true
			let partFailHint = ""

			if (diffResult.failParts && diffResult.failParts.length > 0) {
				partFailHint = `But unable to apply all diff parts to file: ${absolutePath}, silently use <read_file> tool to check newest file version and re-apply diffs\n`
			}

			// Get the formatted response message
			const message = await assista.diffViewProvider.pushToolWriteResult(assista, assista.cwd, !fileExists)

			if (partFailHint) {
				pushToolResult(partFailHint + message)
			} else {
				pushToolResult(message)
			}

			await assista.diffViewProvider.reset()

			return
		}
	} catch (error) {
		await handleError("applying diff", error)
		await assista.diffViewProvider.reset()
		return
	}
}
