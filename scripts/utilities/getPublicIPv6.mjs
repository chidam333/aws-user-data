import { GREEN } from "../colors.mjs";
import { isValidIPv6 } from "./isValidIPv6.mjs";

export async function getPublicIPv6() {
	console.log("Fetching public IPv6 address from ifconfig.me...");

	let response;
	try {
		response = await fetch("https://ifconfig.me", {
			headers: {
				"User-Agent": "cloudflare-ipv6-ddns/1.0",
				Accept: "text/plain",
			},
		});
	} catch (error) {
		throw new Error(
			`fetch failed: ${error.message} (cause: ${error.cause?.message || "unknown"})`
		);
	}

	if (!response.ok) {
		throw new Error(
			`IPv6 probe failed (${response.status}) for https://ifconfig.me`
		);
	}

	const ip = (await response.text()).trim();
	if (!isValidIPv6(ip)) {
		throw new Error(
			`ifconfig.me returned a non-IPv6 address: ${ip}`
		);
	}

	console.log(`\n\n${GREEN}Public IPv6: ${ip}${RESET}`);
	return ip;
}
