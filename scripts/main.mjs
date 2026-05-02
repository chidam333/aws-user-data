import { copyNginxConfig } from "./nginx.mjs";
import { runCloudflareIPv6Updater } from "./cloudfare.mjs";
import { getPublicIPv6 } from "./utilities/getPublicIPv6.mjs";
import { RED, RESET } from "./colors.mjs";

async function main() {
	await copyNginxConfig(process.argv[2]);
	const publicIPv6 = await getPublicIPv6();
	await runCloudflareIPv6Updater(publicIPv6);
}

main().catch((error) => {
	console.error(`${RED}${error.message}${RESET}`);
	process.exitCode = 1;
});
