import { GREEN, RESET } from "../colors.mjs";
import { isValidIPv6 } from "./isValidIPv6.mjs";

export async function getPublicIPv6() {
	console.log(`${GREEN}Fetching public IPv6 from ifconfig.me/ip...${RESET}`);

	let response;
	try {
		response = await fetch("https://ifconfig.me/ip", {
			headers: {
				"User-Agent": "curl/8.5.0",
			},
		});
	} catch (error) {
		throw new Error(
			`fetch failed: ${error.message} (cause: ${error.cause?.message || "unknown"})`
		);
	}

	if (!response.ok) {
		throw new Error(
			`IPv6 probe failed (${response.status}) for https://ifconfig.me/ip`
		);
	}

	const ip = (await response.text()).trim();
	if (!isValidIPv6(ip)) {
		throw new Error(
			`ifconfig.me/ip returned a non-IPv6 address: ${ip}`
		);
	}

	console.log(`\n\n${GREEN}Public IPv6: ${ip}${RESET}`);
	return ip;
}
