#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { GREEN, RED, RESET, YELLOW } from "./colors.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const execFileAsync = promisify(execFile);

async function reloadNginx() {
	try {
		await execFileAsync("systemctl", ["reload", "nginx"]);
		return;
	} catch (error) {
		console.error(
			`${YELLOW}systemctl reload nginx failed: ${error.message}${RESET}`
		);
	}

	try {
		await execFileAsync("nginx", ["-s", "reload"]);
	} catch (error) {
		console.error(
			`${RED}nginx -s reload failed: ${error.message}${RESET}`
		);
		throw error;
	}
}

/** Copies the project's nginx directory into the system nginx config path. */
export async function copyNginxConfig(targetOverride) {
	const sourceDir = path.resolve(projectRoot, "scripts", "nginx");
	const targetDir =  "/etc/nginx"

	const sourceStats = await fs.stat(sourceDir).catch(() => null);

	await fs.cp(sourceDir, targetDir, {
		recursive: true,
		force: true,
	});

	await reloadNginx();

	console.log(
		`${GREEN}Copied nginx config from:\n  ${sourceDir}\nto:\n  ${targetDir}\nReloaded nginx successfully.${RESET}`
	);
}
