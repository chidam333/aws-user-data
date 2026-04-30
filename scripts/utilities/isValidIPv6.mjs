export function isValidIPv6(ip) {
	if (!ip || typeof ip !== "string") return false;
	// Basic IPv6 shape validation for API and update safety.
	return /^[0-9a-fA-F:]+$/.test(ip) && ip.includes(":");
}
