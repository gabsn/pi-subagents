import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { SUBAGENT_CHILD_ENV, SUBAGENT_RUNNER_PID_ENV } from "../../src/runs/shared/child-runtime-config.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("async runner pid marker", () => {
	it("matches the runner's own pid and not the pid of a process it spawns", () => {
		const script = String.raw`
			import { execFileSync } from "node:child_process";
			await import("./src/runs/background/subagent-runner.ts");
			const child = JSON.parse(execFileSync(process.execPath, [
				"--input-type=module",
				"--eval",
				"console.log(JSON.stringify({ pid: process.pid, marker: process.env.${SUBAGENT_RUNNER_PID_ENV} }))",
			], { encoding: "utf-8" }));
			console.log(JSON.stringify({ pid: process.pid, marker: process.env.${SUBAGENT_RUNNER_PID_ENV}, child }));
		`;
		const env = { ...process.env, [SUBAGENT_RUNNER_PID_ENV]: "1" };
		delete env[SUBAGENT_CHILD_ENV];
		const output = execFileSync(
			process.execPath,
			["--experimental-strip-types", "--import", "./test/support/register-loader.mjs", "--input-type=module", "--eval", script],
			{ cwd: projectRoot, env, encoding: "utf-8", timeout: 60_000 },
		);
		const result = JSON.parse(output.trim().split("\n").at(-1)!) as {
			pid: number;
			marker?: string;
			child: { pid: number; marker?: string };
		};

		assert.equal(result.marker, String(result.pid));
		assert.equal(result.child.marker, String(result.pid));
		assert.notEqual(result.child.marker, String(result.child.pid));
	});
});
