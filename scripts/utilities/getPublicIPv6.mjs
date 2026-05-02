import { isValidIPv6 } from "./isValidIPv6.mjs";

export async function getPublicIPv6() {
	let response;
	try {
		response = await fetch("http://checkip.amazonaws.com", {
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
			`IPv6 probe failed (${response.status}) for http://checkip.amazonaws.com`
		);
	}

	const ip = (await response.text()).trim();
	if (!isValidIPv6(ip)) {
		throw new Error(
			`checkip.amazonaws.com returned a non-IPv6 address: ${ip}`
		);
	}

	return ip;
}
