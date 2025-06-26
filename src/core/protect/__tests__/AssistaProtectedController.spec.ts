import path from "path"
import { AssistaProtectedController } from "../AssistaProtectedController"

describe("AssistaProtectedController", () => {
	const TEST_CWD = "/test/workspace"
	let controller: AssistaProtectedController

	beforeEach(() => {
		controller = new AssistaProtectedController(TEST_CWD)
	})

	describe("isWriteProtected", () => {
		it("should protect .assistaignore file", () => {
			expect(controller.isWriteProtected(".assistaignore")).toBe(true)
		})

		it("should protect files in .assista directory", () => {
			expect(controller.isWriteProtected(".assista/config.json")).toBe(true)
			expect(controller.isWriteProtected(".assista/settings/user.json")).toBe(true)
			expect(controller.isWriteProtected(".assista/modes/custom.json")).toBe(true)
		})

		it("should protect .assistaprotected file", () => {
			expect(controller.isWriteProtected(".assistaprotected")).toBe(true)
		})

		it("should protect .assistamodes files", () => {
			expect(controller.isWriteProtected(".assistamodes")).toBe(true)
		})

		it("should protect .assistarules* files", () => {
			expect(controller.isWriteProtected(".assistarules")).toBe(true)
			expect(controller.isWriteProtected(".assistarules.md")).toBe(true)
		})

		it("should protect .assistarules* files", () => {
			expect(controller.isWriteProtected(".assistarules")).toBe(true)
			expect(controller.isWriteProtected(".assistarules.md")).toBe(true)
		})

		it("should not protect other files starting with .assista", () => {
			expect(controller.isWriteProtected(".assistasettings")).toBe(false)
			expect(controller.isWriteProtected(".assistaconfig")).toBe(false)
		})

		it("should not protect regular files", () => {
			expect(controller.isWriteProtected("src/index.ts")).toBe(false)
			expect(controller.isWriteProtected("package.json")).toBe(false)
			expect(controller.isWriteProtected("README.md")).toBe(false)
		})

		it("should not protect files that contain 'assista' but don't start with .assista", () => {
			expect(controller.isWriteProtected("src/assista-utils.ts")).toBe(false)
			expect(controller.isWriteProtected("config/assista.config.js")).toBe(false)
		})

		it("should handle nested paths correctly", () => {
			expect(controller.isWriteProtected(".assista/config.json")).toBe(true) // .assista/** matches at root
			expect(controller.isWriteProtected("nested/.assistaignore")).toBe(true) // .assistaignore matches anywhere by default
			expect(controller.isWriteProtected("nested/.assistamodes")).toBe(true) // .assistamodes matches anywhere by default
			expect(controller.isWriteProtected("nested/.assistarules.md")).toBe(true) // .assistarules* matches anywhere by default
		})

		it("should handle absolute paths by converting to relative", () => {
			const absolutePath = path.join(TEST_CWD, ".assistaignore")
			expect(controller.isWriteProtected(absolutePath)).toBe(true)
		})

		it("should handle paths with different separators", () => {
			expect(controller.isWriteProtected(".assista\\config.json")).toBe(true)
			expect(controller.isWriteProtected(".assista/config.json")).toBe(true)
		})
	})

	describe("getProtectedFiles", () => {
		it("should return set of protected files from a list", () => {
			const files = ["src/index.ts", ".assistaignore", "package.json", ".assista/config.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set([".assistaignore", ".assista/config.json"]))
		})

		it("should return empty set when no files are protected", () => {
			const files = ["src/index.ts", "package.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set())
		})
	})

	describe("annotatePathsWithProtection", () => {
		it("should annotate paths with protection status", () => {
			const files = ["src/index.ts", ".assistaignore", ".assista/config.json", "package.json"]

			const annotated = controller.annotatePathsWithProtection(files)

			expect(annotated).toEqual([
				{ path: "src/index.ts", isProtected: false },
				{ path: ".assistaignore", isProtected: true },
				{ path: ".assista/config.json", isProtected: true },
				{ path: "package.json", isProtected: false },
			])
		})
	})

	describe("getProtectionMessage", () => {
		it("should return appropriate protection message", () => {
			const message = controller.getProtectionMessage()
			expect(message).toBe("This is a Assista configuration file and requires approval for modifications")
		})
	})

	describe("getInstructions", () => {
		it("should return formatted instructions about protected files", () => {
			const instructions = controller.getInstructions()

			expect(instructions).toContain("# Protected Files")
			expect(instructions).toContain("write-protected")
			expect(instructions).toContain(".assistaignore")
			expect(instructions).toContain(".assista/**")
			expect(instructions).toContain("\u{1F6E1}") // Shield symbol
		})
	})

	describe("getProtectedPatterns", () => {
		it("should return the list of protected patterns", () => {
			const patterns = AssistaProtectedController.getProtectedPatterns()

			expect(patterns).toEqual([
				".assistaignore",
				".assistamodes",
				".assistarules*",
				".assistarules*",
				".assista/**",
				".assistaprotected",
			])
		})
	})
})
