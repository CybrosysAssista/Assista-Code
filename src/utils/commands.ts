import type { CommandId, CodeActionId, TerminalActionId } from "@cybrosys-assista/types"

import { Package } from "../shared/package"

export const getCommand = (id: CommandId) => `${Package.name}.${id}`

export const getCodeActionCommand = (id: CodeActionId) => `${Package.name}.${id}`

export const getTerminalCommand = (id: TerminalActionId) => `${Package.name}.${id}`
