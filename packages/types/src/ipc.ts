import { z } from "zod"

import { assistaMessageSchema, tokenUsageSchema } from "./message.js"
import { toolNamesSchema, toolUsageSchema } from "./tool.js"
import { cybrosysAssistaSettingsSchema } from "./global-settings.js"

/**
 * isSubtaskSchema
 */
export const isSubtaskSchema = z.object({
	isSubtask: z.boolean(),
})
export type IsSubtask = z.infer<typeof isSubtaskSchema>

/**
 * CybrosysAssistaEvent
 */

export enum CybrosysAssistaEventName {
	Message = "message",
	TaskCreated = "taskCreated",
	TaskStarted = "taskStarted",
	TaskModeSwitched = "taskModeSwitched",
	TaskPaused = "taskPaused",
	TaskUnpaused = "taskUnpaused",
	TaskAskResponded = "taskAskResponded",
	TaskAborted = "taskAborted",
	TaskSpawned = "taskSpawned",
	TaskCompleted = "taskCompleted",
	TaskTokenUsageUpdated = "taskTokenUsageUpdated",
	TaskToolFailed = "taskToolFailed",
	EvalPass = "evalPass",
	EvalFail = "evalFail",
}

export const cybrosysAssistaEventsSchema = z.object({
	[CybrosysAssistaEventName.Message]: z.tuple([
		z.object({
			taskId: z.string(),
			action: z.union([z.literal("created"), z.literal("updated")]),
			message: assistaMessageSchema,
		}),
	]),
	[CybrosysAssistaEventName.TaskCreated]: z.tuple([z.string()]),
	[CybrosysAssistaEventName.TaskStarted]: z.tuple([z.string()]),
	[CybrosysAssistaEventName.TaskModeSwitched]: z.tuple([z.string(), z.string()]),
	[CybrosysAssistaEventName.TaskPaused]: z.tuple([z.string()]),
	[CybrosysAssistaEventName.TaskUnpaused]: z.tuple([z.string()]),
	[CybrosysAssistaEventName.TaskAskResponded]: z.tuple([z.string()]),
	[CybrosysAssistaEventName.TaskAborted]: z.tuple([z.string()]),
	[CybrosysAssistaEventName.TaskSpawned]: z.tuple([z.string(), z.string()]),
	[CybrosysAssistaEventName.TaskCompleted]: z.tuple([z.string(), tokenUsageSchema, toolUsageSchema, isSubtaskSchema]),
	[CybrosysAssistaEventName.TaskTokenUsageUpdated]: z.tuple([z.string(), tokenUsageSchema]),
	[CybrosysAssistaEventName.TaskToolFailed]: z.tuple([z.string(), toolNamesSchema, z.string()]),
})

export type CybrosysAssistaEvents = z.infer<typeof cybrosysAssistaEventsSchema>

/**
 * Ack
 */

export const ackSchema = z.object({
	clientId: z.string(),
	pid: z.number(),
	ppid: z.number(),
})

export type Ack = z.infer<typeof ackSchema>

/**
 * TaskCommand
 */

export enum TaskCommandName {
	StartNewTask = "StartNewTask",
	CancelTask = "CancelTask",
	CloseTask = "CloseTask",
}

export const taskCommandSchema = z.discriminatedUnion("commandName", [
	z.object({
		commandName: z.literal(TaskCommandName.StartNewTask),
		data: z.object({
			configuration: cybrosysAssistaSettingsSchema,
			text: z.string(),
			images: z.array(z.string()).optional(),
			newTab: z.boolean().optional(),
		}),
	}),
	z.object({
		commandName: z.literal(TaskCommandName.CancelTask),
		data: z.string(),
	}),
	z.object({
		commandName: z.literal(TaskCommandName.CloseTask),
		data: z.string(),
	}),
])

export type TaskCommand = z.infer<typeof taskCommandSchema>

/**
 * TaskEvent
 */

export const taskEventSchema = z.discriminatedUnion("eventName", [
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.Message),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.Message],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.TaskCreated),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.TaskCreated],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.TaskStarted),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.TaskStarted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.TaskModeSwitched),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.TaskModeSwitched],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.TaskPaused),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.TaskPaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.TaskUnpaused),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.TaskUnpaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.TaskAskResponded),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.TaskAskResponded],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.TaskAborted),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.TaskAborted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.TaskSpawned),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.TaskSpawned],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.TaskCompleted),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.TaskCompleted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.TaskTokenUsageUpdated),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.TaskTokenUsageUpdated],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.TaskToolFailed),
		payload: cybrosysAssistaEventsSchema.shape[CybrosysAssistaEventName.TaskToolFailed],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.EvalPass),
		payload: z.undefined(),
		taskId: z.number(),
	}),
	z.object({
		eventName: z.literal(CybrosysAssistaEventName.EvalFail),
		payload: z.undefined(),
		taskId: z.number(),
	}),
])

export type TaskEvent = z.infer<typeof taskEventSchema>

/**
 * IpcMessage
 */

export enum IpcMessageType {
	Connect = "Connect",
	Disconnect = "Disconnect",
	Ack = "Ack",
	TaskCommand = "TaskCommand",
	TaskEvent = "TaskEvent",
}

export enum IpcOrigin {
	Client = "client",
	Server = "server",
}

export const ipcMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(IpcMessageType.Ack),
		origin: z.literal(IpcOrigin.Server),
		data: ackSchema,
	}),
	z.object({
		type: z.literal(IpcMessageType.TaskCommand),
		origin: z.literal(IpcOrigin.Client),
		clientId: z.string(),
		data: taskCommandSchema,
	}),
	z.object({
		type: z.literal(IpcMessageType.TaskEvent),
		origin: z.literal(IpcOrigin.Server),
		relayClientId: z.string().optional(),
		data: taskEventSchema,
	}),
])

export type IpcMessage = z.infer<typeof ipcMessageSchema>

/**
 * Client
 */

export type IpcClientEvents = {
	[IpcMessageType.Connect]: []
	[IpcMessageType.Disconnect]: []
	[IpcMessageType.Ack]: [data: Ack]
	[IpcMessageType.TaskCommand]: [data: TaskCommand]
	[IpcMessageType.TaskEvent]: [data: TaskEvent]
}

/**
 * Server
 */

export type IpcServerEvents = {
	[IpcMessageType.Connect]: [clientId: string]
	[IpcMessageType.Disconnect]: [clientId: string]
	[IpcMessageType.TaskCommand]: [clientId: string, data: TaskCommand]
	[IpcMessageType.TaskEvent]: [relayClientId: string | undefined, data: TaskEvent]
}
