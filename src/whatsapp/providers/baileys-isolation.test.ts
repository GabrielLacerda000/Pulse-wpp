import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const SRC_ROOT = join(import.meta.dir, "..", "..");
const ALLOWED_FILE = join(import.meta.dir, "BaileysProvider.ts");

async function listSourceFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				return listSourceFiles(fullPath);
			}
			return entry.name.endsWith(".ts") ? [fullPath] : [];
		}),
	);
	return files.flat();
}

describe("Baileys isolation", () => {
	it("is only imported from BaileysProvider.ts (GUIDELINES §5)", async () => {
		const files = await listSourceFiles(SRC_ROOT);
		const offenders: string[] = [];

		for (const file of files) {
			if (file === ALLOWED_FILE || file.endsWith(".test.ts")) {
				continue;
			}
			const content = await readFile(file, "utf-8");
			if (/from\s+["'](@whiskeysockets\/baileys|baileys)["']/.test(content)) {
				offenders.push(relative(SRC_ROOT, file));
			}
		}

		expect(offenders).toEqual([]);
	});
});
