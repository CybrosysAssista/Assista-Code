// npx vitest core/prompts/sections/__tests__/custom-instructions.spec.ts

// Mock fs/promises
vi.mock("fs/promises")

// Mock path.resolve and path.join to be predictable in tests
vi.mock("path", async () => ({
	...(await vi.importActual("path")),
	resolve: vi.fn().mockImplementation((...args) => {
		// On Windows, use backslashes; on Unix, use forward slashes
		const separator = process.platform === "win32" ? "\\" : "/"
		// Filter out empty strings and normalize separators
		const cleanArgs = args
			.filter((arg) => arg && arg.trim() !== "")
			.map((arg) => arg.toString().replace(/[/\\]+/g, separator))
		// If first arg is absolute, use it as base, otherwise join all
		if (cleanArgs.length === 0) return ""
		if (cleanArgs[0].match(/^([a-zA-Z]:)?[/\\]/)) {
			// First arg is absolute path
			let result = cleanArgs[0]
			for (let i = 1; i < cleanArgs.length; i++) {
				if (!result.endsWith(separator)) result += separator
				result += cleanArgs[i]
			}
			return result
		} else {
			// Relative path resolution
			return cleanArgs.join(separator)
		}
	}),
	join: vi.fn().mockImplementation((...args) => {
		const separator = process.platform === "win32" ? "\\" : "/"
		// Filter out empty strings and normalize separators
		const cleanArgs = args
			.filter((arg) => arg && arg.trim() !== "")
			.map((arg) => arg.toString().replace(/[/\\]+/g, separator))
		return cleanArgs.join(separator)
	}),
	relative: vi.fn().mockImplementation((from, to) => to),
	dirname: vi.fn().mockImplementation((path) => {
		const separator = process.platform === "win32" ? "\\" : "/"
		const parts = path.split(/[/\\]/)
		return parts.slice(0, -1).join(separator)
	}),
}))

import fs from "fs/promises"
import type { PathLike } from "fs"

import { loadRuleFiles, addCustomInstructions } from "../custom-instructions"

// Create mock functions
const readFileMock = vi.fn()
const statMock = vi.fn()
const readdirMock = vi.fn()
const readlinkMock = vi.fn()

// Replace fs functions with our mocks
fs.readFile = readFileMock as any
fs.stat = statMock as any
fs.readdir = readdirMock as any
fs.readlink = readlinkMock as any

// Mock process.cwd
const originalCwd = process.cwd
beforeAll(() => {
	process.cwd = vi.fn().mockReturnValue("/fake/cwd")
})

afterAll(() => {
	process.cwd = originalCwd
})

describe("loadRuleFiles", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should read and trim file content", async () => {
		// Simulate no .assista/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockResolvedValue("  content with spaces  ")
		const result = await loadRuleFiles("/fake/path")
		expect(readFileMock).toHaveBeenCalled()
		expect(result).toBe("\n# Rules from .assistarules:\ncontent with spaces\n")
	})

	it("should handle ENOENT error", async () => {
		// Simulate no .assista/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockRejectedValue({ code: "ENOENT" })
		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should handle EISDIR error", async () => {
		// Simulate no .assista/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockRejectedValue({ code: "EISDIR" })
		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should throw on unexpected errors", async () => {
		// Simulate no .assista/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		const error = new Error("Permission denied") as NodeJS.ErrnoException
		error.code = "EPERM"
		readFileMock.mockRejectedValue(error)

		await expect(async () => {
			await loadRuleFiles("/fake/path")
		}).rejects.toThrow()
	})

	it("should not combine content from multiple rule files when they exist", async () => {
		// Simulate no .assista/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".assistarules")) {
				return Promise.resolve("assista rules content")
			}
			if (filePath.toString().endsWith(".assistarules")) {
				return Promise.resolve("assista rules content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .assistarules:\nassista rules content\n")
	})

	it("should handle when no rule files exist", async () => {
		// Simulate no .assista/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should skip directories with same name as rule files", async () => {
		// Simulate no .assista/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".assistarules")) {
				return Promise.reject({ code: "EISDIR" })
			}
			if (filePath.toString().endsWith(".assistarules")) {
				return Promise.reject({ code: "EISDIR" })
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should use .assista/rules/ directory when it exists and has files", async () => {
		// Simulate .assista/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: vi.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files
		readdirMock.mockResolvedValueOnce([
			{ name: "file1.txt", isFile: () => true, isSymbolicLink: () => false, parentPath: "/fake/path/.assista/rules" },
			{ name: "file2.txt", isFile: () => true, isSymbolicLink: () => false, parentPath: "/fake/path/.assista/rules" },
		] as any)

		statMock.mockImplementation((path) => {
			// Handle both Unix and Windows path separators
			const normalizedPath = path.toString().replace(/\\/g, "/")
			if (
				normalizedPath.includes("/fake/path/.assista/rules/file1.txt") ||
				normalizedPath.includes("/fake/path/.assista/rules/file2.txt")
			) {
				return Promise.resolve({
					isFile: vi.fn().mockReturnValue(true),
				}) as any
			}
			return Promise.resolve({
				isFile: vi.fn().mockReturnValue(false),
			}) as any
		})

		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			// Handle both Unix and Windows path separators
			const normalizedPath = pathStr.replace(/\\/g, "/")
			if (normalizedPath === "/fake/path/.assista/rules/file1.txt") {
				return Promise.resolve("content of file1")
			}
			if (normalizedPath === "/fake/path/.assista/rules/file2.txt") {
				return Promise.resolve("content of file2")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		const expectedPath1 =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules\\file1.txt" : "/fake/path/.assista/rules/file1.txt"
		const expectedPath2 =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules\\file2.txt" : "/fake/path/.assista/rules/file2.txt"
		expect(result).toContain(`# Rules from ${expectedPath1}:`)
		expect(result).toContain("content of file1")
		expect(result).toContain(`# Rules from ${expectedPath2}:`)
		expect(result).toContain("content of file2")

		// We expect both checks because our new implementation checks the files again for validation
		const expectedRulesDir = process.platform === "win32" ? "\\fake\\path\\.assista\\rules" : "/fake/path/.assista/rules"
		const expectedFile1Path =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules\\file1.txt" : "/fake/path/.assista/rules/file1.txt"
		const expectedFile2Path =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules\\file2.txt" : "/fake/path/.assista/rules/file2.txt"

		expect(statMock).toHaveBeenCalledWith(expectedRulesDir)
		expect(statMock).toHaveBeenCalledWith(expectedFile1Path)
		expect(statMock).toHaveBeenCalledWith(expectedFile2Path)
		expect(readFileMock).toHaveBeenCalledWith(expectedFile1Path, "utf-8")
		expect(readFileMock).toHaveBeenCalledWith(expectedFile2Path, "utf-8")
	})

	it("should fall back to .assistarules when .assista/rules/ is empty", async () => {
		// Simulate .assista/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: vi.fn().mockReturnValue(true),
		} as any)

		// Simulate empty directory
		readdirMock.mockResolvedValueOnce([])

		// Simulate .assistarules exists
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".assistarules")) {
				return Promise.resolve("assista rules content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .assistarules:\nassista rules content\n")
	})

	it("should handle errors when reading directory", async () => {
		// Simulate .assista/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: vi.fn().mockReturnValue(true),
		} as any)

		// Simulate error reading directory
		readdirMock.mockRejectedValueOnce(new Error("Failed to read directory"))

		// Simulate .assistarules exists
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".assistarules")) {
				return Promise.resolve("assista rules content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .assistarules:\nassista rules content\n")
	})

	it("should read files from nested subdirectories in .assista/rules/", async () => {
		// Simulate .assista/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: vi.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files including subdirectories
		readdirMock.mockResolvedValueOnce([
			{
				name: "subdir",
				isFile: () => false,
				isSymbolicLink: () => false,
				isDirectory: () => true,
				parentPath: "/fake/path/.assista/rules",
			},
			{
				name: "root.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				isDirectory: () => false,
				parentPath: "/fake/path/.assista/rules",
			},
			{
				name: "nested1.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				isDirectory: () => false,
				parentPath: "/fake/path/.assista/rules/subdir",
			},
			{
				name: "nested2.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				isDirectory: () => false,
				parentPath: "/fake/path/.assista/rules/subdir/subdir2",
			},
		] as any)

		statMock.mockImplementation((path: string) => {
			// Handle both Unix and Windows path separators
			const normalizedPath = path.toString().replace(/\\/g, "/")
			if (normalizedPath.endsWith("txt")) {
				return Promise.resolve({
					isFile: vi.fn().mockReturnValue(true),
					isDirectory: vi.fn().mockReturnValue(false),
				} as any)
			}
			return Promise.resolve({
				isFile: vi.fn().mockReturnValue(false),
				isDirectory: vi.fn().mockReturnValue(true),
			} as any)
		})

		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			// Handle both Unix and Windows path separators
			const normalizedPath = pathStr.replace(/\\/g, "/")
			if (normalizedPath === "/fake/path/.assista/rules/root.txt") {
				return Promise.resolve("root file content")
			}
			if (normalizedPath === "/fake/path/.assista/rules/subdir/nested1.txt") {
				return Promise.resolve("nested file 1 content")
			}
			if (normalizedPath === "/fake/path/.assista/rules/subdir/subdir2/nested2.txt") {
				return Promise.resolve("nested file 2 content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")

		// Check root file content
		const expectedRootPath =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules\\root.txt" : "/fake/path/.assista/rules/root.txt"
		const expectedNested1Path =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\rules\\subdir\\nested1.txt"
				: "/fake/path/.assista/rules/subdir/nested1.txt"
		const expectedNested2Path =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\rules\\subdir\\subdir2\\nested2.txt"
				: "/fake/path/.assista/rules/subdir/subdir2/nested2.txt"

		expect(result).toContain(`# Rules from ${expectedRootPath}:`)
		expect(result).toContain("root file content")

		// Check nested files content
		expect(result).toContain(`# Rules from ${expectedNested1Path}:`)
		expect(result).toContain("nested file 1 content")
		expect(result).toContain(`# Rules from ${expectedNested2Path}:`)
		expect(result).toContain("nested file 2 content")

		// Verify correct paths were checked
		const expectedRootPath2 =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules\\root.txt" : "/fake/path/.assista/rules/root.txt"
		const expectedNested1Path2 =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\rules\\subdir\\nested1.txt"
				: "/fake/path/.assista/rules/subdir/nested1.txt"
		const expectedNested2Path2 =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\rules\\subdir\\subdir2\\nested2.txt"
				: "/fake/path/.assista/rules/subdir/subdir2/nested2.txt"

		expect(statMock).toHaveBeenCalledWith(expectedRootPath2)
		expect(statMock).toHaveBeenCalledWith(expectedNested1Path2)
		expect(statMock).toHaveBeenCalledWith(expectedNested2Path2)

		// Verify files were read with correct paths
		expect(readFileMock).toHaveBeenCalledWith(expectedRootPath2, "utf-8")
		expect(readFileMock).toHaveBeenCalledWith(expectedNested1Path2, "utf-8")
		expect(readFileMock).toHaveBeenCalledWith(expectedNested2Path2, "utf-8")
	})
})

describe("addCustomInstructions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should combine all instruction types when provided", async () => {
		// Simulate no .assista/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockResolvedValue("mode specific rules")

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
			{ language: "es" },
		)

		expect(result).toContain("Language Preference:")
		expect(result).toContain("Español") // Check for language name
		expect(result).toContain("(es)") // Check for language code in parentheses
		expect(result).toContain("Global Instructions:\nglobal instructions")
		expect(result).toContain("Mode-specific Instructions:\nmode instructions")
		expect(result).toContain("Rules from .assistarules-test-mode:\nmode specific rules")
	})

	it("should return empty string when no instructions provided", async () => {
		// Simulate no .assista/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await addCustomInstructions("", "", "/fake/path", "", {})
		expect(result).toBe("")
	})

	it("should handle missing mode-specific rules file", async () => {
		// Simulate no .assista/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Global Instructions:")
		expect(result).toContain("Mode-specific Instructions:")
		expect(result).not.toContain("Rules from .assistarules-test-mode")
	})

	it("should handle unknown language codes properly", async () => {
		// Simulate no .assista/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
			{ language: "xyz" }, // Unknown language code
		)

		expect(result).toContain("Language Preference:")
		expect(result).toContain('"xyz" (xyz) language') // For unknown codes, the code is used as the name too
		expect(result).toContain("Global Instructions:\nglobal instructions")
	})

	it("should throw on unexpected errors", async () => {
		// Simulate no .assista/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		const error = new Error("Permission denied") as NodeJS.ErrnoException
		error.code = "EPERM"
		readFileMock.mockRejectedValue(error)

		await expect(async () => {
			await addCustomInstructions("", "", "/fake/path", "test-mode")
		}).rejects.toThrow()
	})

	it("should skip mode-specific rule files that are directories", async () => {
		// Simulate no .assista/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().includes(".assistarules-test-mode")) {
				return Promise.reject({ code: "EISDIR" })
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Global Instructions:\nglobal instructions")
		expect(result).toContain("Mode-specific Instructions:\nmode instructions")
		expect(result).not.toContain("Rules from .assistarules-test-mode")
	})

	it("should use .assista/rules-test-mode/ directory when it exists and has files", async () => {
		// Simulate .assista/rules-test-mode directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: vi.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files
		readdirMock.mockResolvedValueOnce([
			{
				name: "rule1.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				parentPath: "/fake/path/.assista/rules-test-mode",
			},
			{
				name: "rule2.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				parentPath: "/fake/path/.assista/rules-test-mode",
			},
		] as any)

		statMock.mockImplementation((path) => {
			// Handle both Unix and Windows path separators
			const normalizedPath = path.toString().replace(/\\/g, "/")
			if (
				normalizedPath.includes("/fake/path/.assista/rules-test-mode/rule1.txt") ||
				normalizedPath.includes("/fake/path/.assista/rules-test-mode/rule2.txt")
			) {
				return Promise.resolve({
					isFile: vi.fn().mockReturnValue(true),
				}) as any
			}
			return Promise.resolve({
				isFile: vi.fn().mockReturnValue(false),
			}) as any
		})

		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			// Handle both Unix and Windows path separators
			const normalizedPath = pathStr.replace(/\\/g, "/")
			if (normalizedPath === "/fake/path/.assista/rules-test-mode/rule1.txt") {
				return Promise.resolve("mode specific rule 1")
			}
			if (normalizedPath === "/fake/path/.assista/rules-test-mode/rule2.txt") {
				return Promise.resolve("mode specific rule 2")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
			{ language: "es" },
		)

		const expectedTestModeDir =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules-test-mode" : "/fake/path/.assista/rules-test-mode"
		const expectedRule1Path =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\rules-test-mode\\rule1.txt"
				: "/fake/path/.assista/rules-test-mode/rule1.txt"
		const expectedRule2Path =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\rules-test-mode\\rule2.txt"
				: "/fake/path/.assista/rules-test-mode/rule2.txt"

		expect(result).toContain(`# Rules from ${expectedTestModeDir}`)
		expect(result).toContain(`# Rules from ${expectedRule1Path}:`)
		expect(result).toContain("mode specific rule 1")
		expect(result).toContain(`# Rules from ${expectedRule2Path}:`)
		expect(result).toContain("mode specific rule 2")

		const expectedTestModeDir2 =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules-test-mode" : "/fake/path/.assista/rules-test-mode"
		const expectedRule1Path2 =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\rules-test-mode\\rule1.txt"
				: "/fake/path/.assista/rules-test-mode/rule1.txt"
		const expectedRule2Path2 =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\rules-test-mode\\rule2.txt"
				: "/fake/path/.assista/rules-test-mode/rule2.txt"

		expect(statMock).toHaveBeenCalledWith(expectedTestModeDir2)
		expect(statMock).toHaveBeenCalledWith(expectedRule1Path2)
		expect(statMock).toHaveBeenCalledWith(expectedRule2Path2)
		expect(readFileMock).toHaveBeenCalledWith(expectedRule1Path2, "utf-8")
		expect(readFileMock).toHaveBeenCalledWith(expectedRule2Path2, "utf-8")
	})

	it("should fall back to .assistarules-test-mode when .assista/rules-test-mode/ does not exist", async () => {
		// Simulate .assista/rules-test-mode directory does not exist
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		// Simulate .assistarules-test-mode exists
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().includes(".assistarules-test-mode")) {
				return Promise.resolve("mode specific rules from file")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Rules from .assistarules-test-mode:\nmode specific rules from file")
	})

	it("should fall back to .assistarules-test-mode when .assista/rules-test-mode/ and .assistarules-test-mode do not exist", async () => {
		// Simulate .assista/rules-test-mode directory does not exist
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		// Simulate file reading
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().includes(".assistarules-test-mode")) {
				return Promise.reject({ code: "ENOENT" })
			}
			if (filePath.toString().includes(".assistarules-test-mode")) {
				return Promise.resolve("mode specific rules from assista file")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Rules from .assistarules-test-mode:\nmode specific rules from assista file")
	})

	it("should correctly format content from directories when using .assista/rules-test-mode/", async () => {
		// Need to reset mockImplementation first to avoid interference from previous tests
		statMock.mockReset()
		readFileMock.mockReset()

		// Simulate .assista/rules-test-mode directory exists
		statMock.mockImplementationOnce(() =>
			Promise.resolve({
				isDirectory: vi.fn().mockReturnValue(true),
			} as any),
		)

		// Simulate directory has files
		readdirMock.mockResolvedValueOnce([
			{ name: "rule1.txt", isFile: () => true, parentPath: "/fake/path/.assista/rules-test-mode" },
		] as any)
		readFileMock.mockReset()

		// Set up stat mock for checking files
		let statCallCount = 0
		statMock.mockImplementation((filePath) => {
			statCallCount++
			// Handle both Unix and Windows path separators
			const normalizedPath = filePath.toString().replace(/\\/g, "/")
			if (normalizedPath === "/fake/path/.assista/rules-test-mode/rule1.txt") {
				return Promise.resolve({
					isFile: vi.fn().mockReturnValue(true),
					isDirectory: vi.fn().mockReturnValue(false),
				} as any)
			}
			return Promise.resolve({
				isFile: vi.fn().mockReturnValue(false),
				isDirectory: vi.fn().mockReturnValue(false),
			} as any)
		})

		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			// Handle both Unix and Windows path separators
			const normalizedPath = pathStr.replace(/\\/g, "/")
			if (normalizedPath === "/fake/path/.assista/rules-test-mode/rule1.txt") {
				return Promise.resolve("mode specific rule content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		const expectedTestModeDir =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules-test-mode" : "/fake/path/.assista/rules-test-mode"
		const expectedRule1Path =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\rules-test-mode\\rule1.txt"
				: "/fake/path/.assista/rules-test-mode/rule1.txt"

		expect(result).toContain(`# Rules from ${expectedTestModeDir}`)
		expect(result).toContain(`# Rules from ${expectedRule1Path}:`)
		expect(result).toContain("mode specific rule content")

		expect(statCallCount).toBeGreaterThan(0)
	})
})

// Test directory existence checks through loadRuleFiles
describe("Directory existence checks", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should detect when directory exists", async () => {
		// Mock the stats to indicate the directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: vi.fn().mockReturnValue(true),
		} as any)

		// Simulate empty directory to test that stats is called
		readdirMock.mockResolvedValueOnce([])

		// For loadRuleFiles to return something for testing
		readFileMock.mockResolvedValueOnce("fallback content")

		await loadRuleFiles("/fake/path")

		// Verify stat was called to check directory existence
		const expectedRulesDir = process.platform === "win32" ? "\\fake\\path\\.assista\\rules" : "/fake/path/.assista/rules"
		expect(statMock).toHaveBeenCalledWith(expectedRulesDir)
	})

	it("should handle when directory does not exist", async () => {
		// Mock the stats to indicate the directory doesn't exist
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		// Mock file read to verify fallback
		readFileMock.mockResolvedValueOnce("fallback content")

		const result = await loadRuleFiles("/fake/path")

		// Verify it fell back to reading rule files directly
		expect(result).toBe("\n# Rules from .assistarules:\nfallback content\n")
	})
})

// Indirectly test readTextFilesFromDirectory and formatDirectoryContent through loadRuleFiles
describe("Rules directory reading", () => {
	it.skipIf(process.platform === "win32")("should follow symbolic links in the rules directory", async () => {
		// Simulate .assista/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: vi.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files including a symlink
		readdirMock
			.mockResolvedValueOnce([
				{
					name: "regular.txt",
					isFile: () => true,
					isSymbolicLink: () => false,
					parentPath: "/fake/path/.assista/rules",
				},
				{
					name: "link.txt",
					isFile: () => false,
					isSymbolicLink: () => true,
					parentPath: "/fake/path/.assista/rules",
				},
				{
					name: "link_dir",
					isFile: () => false,
					isSymbolicLink: () => true,
					parentPath: "/fake/path/.assista/rules",
				},
				{
					name: "nested_link.txt",
					isFile: () => false,
					isSymbolicLink: () => true,
					parentPath: "/fake/path/.assista/rules",
				},
			] as any)
			.mockResolvedValueOnce([
				{ name: "subdir_link.txt", isFile: () => true, parentPath: "/fake/path/.assista/rules/symlink-target-dir" },
			] as any)

		// Simulate readlink response
		readlinkMock
			.mockResolvedValueOnce("../symlink-target.txt")
			.mockResolvedValueOnce("../symlink-target-dir")
			.mockResolvedValueOnce("../nested-symlink")
			.mockResolvedValueOnce("nested-symlink-target.txt")

		// Reset and set up the stat mock with more granular control
		statMock.mockReset()
		statMock.mockImplementation((path: string) => {
			// For directory check
			if (path === "/fake/path/.assista/rules" || path.endsWith("dir")) {
				return Promise.resolve({
					isDirectory: vi.fn().mockReturnValue(true),
					isFile: vi.fn().mockReturnValue(false),
				} as any)
			}

			// For symlink check
			if (path.endsWith("symlink")) {
				return Promise.resolve({
					isDirectory: vi.fn().mockReturnValue(false),
					isFile: vi.fn().mockReturnValue(false),
					isSymbolicLink: vi.fn().mockReturnValue(true),
				} as any)
			}

			// For all files
			return Promise.resolve({
				isFile: vi.fn().mockReturnValue(true),
				isDirectory: vi.fn().mockReturnValue(false),
			} as any)
		})

		// Simulate file content reading
		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			// Handle both Unix and Windows path separators
			const normalizedPath = pathStr.replace(/\\/g, "/")
			if (normalizedPath === "/fake/path/.assista/rules/regular.txt") {
				return Promise.resolve("regular file content")
			}
			if (normalizedPath === "/fake/path/.assista/symlink-target.txt") {
				return Promise.resolve("symlink target content")
			}
			if (normalizedPath === "/fake/path/.assista/rules/symlink-target-dir/subdir_link.txt") {
				return Promise.resolve("regular file content under symlink target dir")
			}
			if (normalizedPath === "/fake/path/.assista/nested-symlink-target.txt") {
				return Promise.resolve("nested symlink target content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")

		// Verify both regular file and symlink target content are included
		const expectedRegularPath =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\rules\\regular.txt"
				: "/fake/path/.assista/rules/regular.txt"
		const expectedSymlinkPath =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\symlink-target.txt"
				: "/fake/path/.assista/symlink-target.txt"
		const expectedSubdirPath =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\rules\\symlink-target-dir\\subdir_link.txt"
				: "/fake/path/.assista/rules/symlink-target-dir/subdir_link.txt"
		const expectedNestedPath =
			process.platform === "win32"
				? "\\fake\\path\\.assista\\nested-symlink-target.txt"
				: "/fake/path/.assista/nested-symlink-target.txt"

		expect(result).toContain(`# Rules from ${expectedRegularPath}:`)
		expect(result).toContain("regular file content")
		expect(result).toContain(`# Rules from ${expectedSymlinkPath}:`)
		expect(result).toContain("symlink target content")
		expect(result).toContain(`# Rules from ${expectedSubdirPath}:`)
		expect(result).toContain("regular file content under symlink target dir")
		expect(result).toContain(`# Rules from ${expectedNestedPath}:`)
		expect(result).toContain("nested symlink target content")

		// Verify readlink was called with the symlink path
		expect(readlinkMock).toHaveBeenCalledWith("/fake/path/.assista/rules/link.txt")
		expect(readlinkMock).toHaveBeenCalledWith("/fake/path/.assista/rules/link_dir")

		// Verify both files were read
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.assista/rules/regular.txt", "utf-8")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.assista/symlink-target.txt", "utf-8")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.assista/rules/symlink-target-dir/subdir_link.txt", "utf-8")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.assista/nested-symlink-target.txt", "utf-8")
	})
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it.skipIf(process.platform === "win32")("should correctly format multiple files from directory", async () => {
		// Simulate .assista/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: vi.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files
		readdirMock.mockResolvedValueOnce([
			{ name: "file1.txt", isFile: () => true, parentPath: "/fake/path/.assista/rules" },
			{ name: "file2.txt", isFile: () => true, parentPath: "/fake/path/.assista/rules" },
			{ name: "file3.txt", isFile: () => true, parentPath: "/fake/path/.assista/rules" },
		] as any)

		statMock.mockImplementation((path) => {
			// Handle both Unix and Windows path separators
			const normalizedPath = path.toString().replace(/\\/g, "/")
			expect([
				"/fake/path/.assista/rules/file1.txt",
				"/fake/path/.assista/rules/file2.txt",
				"/fake/path/.assista/rules/file3.txt",
			]).toContain(normalizedPath)

			return Promise.resolve({
				isFile: vi.fn().mockReturnValue(true),
			}) as any
		})

		readFileMock.mockImplementation((filePath: PathLike) => {
			const pathStr = filePath.toString()
			// Handle both Unix and Windows path separators
			const normalizedPath = pathStr.replace(/\\/g, "/")
			if (normalizedPath === "/fake/path/.assista/rules/file1.txt") {
				return Promise.resolve("content of file1")
			}
			if (normalizedPath === "/fake/path/.assista/rules/file2.txt") {
				return Promise.resolve("content of file2")
			}
			if (normalizedPath === "/fake/path/.assista/rules/file3.txt") {
				return Promise.resolve("content of file3")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")

		const expectedFile1Path =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules\\file1.txt" : "/fake/path/.assista/rules/file1.txt"
		const expectedFile2Path =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules\\file2.txt" : "/fake/path/.assista/rules/file2.txt"
		const expectedFile3Path =
			process.platform === "win32" ? "\\fake\\path\\.assista\\rules\\file3.txt" : "/fake/path/.assista/rules/file3.txt"

		expect(result).toContain(`# Rules from ${expectedFile1Path}:`)
		expect(result).toContain("content of file1")
		expect(result).toContain(`# Rules from ${expectedFile2Path}:`)
		expect(result).toContain("content of file2")
		expect(result).toContain(`# Rules from ${expectedFile3Path}:`)
		expect(result).toContain("content of file3")
	})

	it("should handle empty file list gracefully", async () => {
		// Simulate .assista/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: vi.fn().mockReturnValue(true),
		} as any)

		// Simulate empty directory
		readdirMock.mockResolvedValueOnce([])

		readFileMock.mockResolvedValueOnce("fallback content")

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .assistarules:\nfallback content\n")
	})
})
