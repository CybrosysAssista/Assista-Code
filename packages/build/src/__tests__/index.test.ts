// npx vitest run src/__tests__/index.test.ts

import { generatePackageJson } from "../index.js"

describe("generatePackageJson", () => {
	it("should be a test", () => {
		const generatedPackageJson = generatePackageJson({
			packageJson: {
				name: "cybrosys-assista",
				displayName: "%extension.displayName%",
				description: "%extension.description%",
				publisher: "cybrosystechnologiesodooofficialpartner",
				version: "3.17.2",
				icon: "assets/icons/icon.png",
				contributes: {
					viewsContainers: {
						activitybar: [
							{
								id: "cybrosys-assista-ActivityBar",
								title: "%views.activitybar.title%",
								icon: "assets/icons/icon.svg",
							},
						],
					},
					views: {
						"cybrosys-assista-ActivityBar": [
							{
								type: "webview",
								id: "cybrosys-assista.SidebarProvider",
								name: "",
							},
						],
					},
					commands: [
						{
							command: "cybrosys-assista.plusButtonClicked",
							title: "%command.newTask.title%",
							icon: "$(add)",
						},
						{
							command: "cybrosys-assista.openInNewTab",
							title: "%command.openInNewTab.title%",
							category: "%configuration.title%",
						},
					],
					menus: {
						"editor/context": [
							{
								submenu: "cybrosys-assista.contextMenu",
								group: "navigation",
							},
						],
						"cybrosys-assista.contextMenu": [
							{
								command: "cybrosys-assista.addToContext",
								group: "1_actions@1",
							},
						],
						"editor/title": [
							{
								command: "cybrosys-assista.plusButtonClicked",
								group: "navigation@1",
								when: "activeWebviewPanelId == cybrosys-assista.TabPanelProvider",
							},
							{
								command: "cybrosys-assista.settingsButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == cybrosys-assista.TabPanelProvider",
							},
							{
								command: "cybrosys-assista.accountButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == cybrosys-assista.TabPanelProvider && config.cybrosys-assista.cybrosysAssistaCloudEnabled",
							},
						],
					},
					submenus: [
						{
							id: "cybrosys-assista.contextMenu",
							label: "%views.contextMenu.label%",
						},
						{
							id: "cybrosys-assista.terminalMenu",
							label: "%views.terminalMenu.label%",
						},
					],
					configuration: {
						title: "%configuration.title%",
						properties: {
							"cybrosys-assista.allowedCommands": {
								type: "array",
								items: {
									type: "string",
								},
								default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
								description: "%commands.allowedCommands.description%",
							},
							"cybrosys-assista.customStoragePath": {
								type: "string",
								default: "",
								description: "%settings.customStoragePath.description%",
							},
						},
					},
				},
				scripts: {
					lint: "eslint **/*.ts",
				},
			},
			overrideJson: {
				name: "cybrosys-assista-nightly",
				displayName: "Cybrosys Assista Nightly",
				publisher: "cybrosystechnologiesodooofficialpartner",
				version: "0.0.1",
				icon: "assets/icons/icon-nightly.png",
				scripts: {},
			},
			substitution: ["cybrosys-assista", "cybrosys-assista-nightly"],
		})

		expect(generatedPackageJson).toStrictEqual({
			name: "cybrosys-assista-nightly",
			displayName: "Cybrosys Assista Nightly",
			description: "%extension.description%",
			publisher: "cybrosystechnologiesodooofficialpartner",
			version: "0.0.1",
			icon: "assets/icons/icon-nightly.png",
			contributes: {
				viewsContainers: {
					activitybar: [
						{
							id: "cybrosys-assista-nightly-ActivityBar",
							title: "%views.activitybar.title%",
							icon: "assets/icons/icon.svg",
						},
					],
				},
				views: {
					"cybrosys-assista-nightly-ActivityBar": [
						{
							type: "webview",
							id: "cybrosys-assista-nightly.SidebarProvider",
							name: "",
						},
					],
				},
				commands: [
					{
						command: "cybrosys-assista-nightly.plusButtonClicked",
						title: "%command.newTask.title%",
						icon: "$(add)",
					},
					{
						command: "cybrosys-assista-nightly.openInNewTab",
						title: "%command.openInNewTab.title%",
						category: "%configuration.title%",
					},
				],
				menus: {
					"editor/context": [
						{
							submenu: "cybrosys-assista-nightly.contextMenu",
							group: "navigation",
						},
					],
					"cybrosys-assista-nightly.contextMenu": [
						{
							command: "cybrosys-assista-nightly.addToContext",
							group: "1_actions@1",
						},
					],
					"editor/title": [
						{
							command: "cybrosys-assista-nightly.plusButtonClicked",
							group: "navigation@1",
							when: "activeWebviewPanelId == cybrosys-assista-nightly.TabPanelProvider",
						},
						{
							command: "cybrosys-assista-nightly.settingsButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == cybrosys-assista-nightly.TabPanelProvider",
						},
						{
							command: "cybrosys-assista-nightly.accountButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == cybrosys-assista-nightly.TabPanelProvider && config.cybrosys-assista-nightly.cybrosysAssistaCloudEnabled",
						},
					],
				},
				submenus: [
					{
						id: "cybrosys-assista-nightly.contextMenu",
						label: "%views.contextMenu.label%",
					},
					{
						id: "cybrosys-assista-nightly.terminalMenu",
						label: "%views.terminalMenu.label%",
					},
				],
				configuration: {
					title: "%configuration.title%",
					properties: {
						"cybrosys-assista-nightly.allowedCommands": {
							type: "array",
							items: {
								type: "string",
							},
							default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
							description: "%commands.allowedCommands.description%",
						},
						"cybrosys-assista-nightly.customStoragePath": {
							type: "string",
							default: "",
							description: "%settings.customStoragePath.description%",
						},
					},
				},
			},
			scripts: {},
		})
	})
})
