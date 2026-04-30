import { copyNginxConfig } from "./nginx.mjs";
import { runCloudflareIPv6Updater } from "./cloudfare.mjs";
import { getPublicIPv6 } from "./utilities/getPublicIPv6.mjs";

async function main() {
	await copyNginxConfig(process.argv[2]);
	const publicIPv6 = await getPublicIPv6();
	await runCloudflareIPv6Updater(publicIPv6);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
