#!/usr/bin/env node

import { getRequiredEnv } from "./utilities/getRequiredEnv.mjs";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "./colors.mjs";
import {
	CF_API_BASE,
	CF_DNS_RECORD_TYPE_AAAA,
	CF_RECORDS_PER_PAGE,
	CF_DNS_TTL,
	CF_PROXIED_DEFAULT,
} from "./constants/cloudfare.constant.mjs";

/** Makes an authenticated request to the Cloudflare API and returns the result,
 * throwing on HTTP or API-level errors. */
async function callCloudflare(path, { method = "GET", body, token }) {
	const response = await fetch(`${CF_API_BASE}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});

	const data = await response.json();
	if (!response.ok || !data.success) {
		const errors = Array.isArray(data.errors)
			? data.errors.map((e) => e.message).join("; ")
			: "Unknown Cloudflare API error";
		throw new Error(`Cloudflare API request failed: ${errors}`);
	}

	return data.result;
}

/** Looks up an existing AAAA record by name in the given zone, returning null if none is found. */
async function findAAAARecord({ zoneId, name, token }) {
	const params = new URLSearchParams({
		type: CF_DNS_RECORD_TYPE_AAAA,
		name,
		per_page: CF_RECORDS_PER_PAGE,
	});

	const result = await callCloudflare(
		`/zones/${zoneId}/dns_records?${params.toString()}`,
		{ token }
	);

	return result[0] ?? null;
}

/** Creates a new AAAA record pointing the given name to the supplied IPv6 address. */
async function createAAAARecord({ zoneId, name, token, ipv6, proxied }) {
	return callCloudflare(`/zones/${zoneId}/dns_records`, {
		method: "POST",
		token,
		body: {
			type: CF_DNS_RECORD_TYPE_AAAA,
			name,
			content: ipv6,
			ttl: CF_DNS_TTL,
			proxied,
		},
	});
}

/** Applies a partial update on an existing AAAA record. */
async function updateAAAARecord({ zoneId, recordId, token, name, ipv6, proxied }) {
	return callCloudflare(`/zones/${zoneId}/dns_records/${recordId}`, {
		method: "PATCH",
		token,
		body: {
			type: CF_DNS_RECORD_TYPE_AAAA,
			name,
			content: ipv6,
			ttl: CF_DNS_TTL,
			proxied,
		},
	});
}

/** Iterates over all configured record names and creates or updates each AAAA record
 * to point to the given public IPv6 address. */
export async function runCloudflareIPv6Updater(publicIPv6) {
	const token = getRequiredEnv("CF_API_TOKEN");
	const zoneId = getRequiredEnv("CF_ZONE_ID");
	const recordNames = getRequiredEnv("CF_RECORD_NAMES")
		.split(",")
		.map((n) => n.trim())
		.filter(Boolean);
	const proxied = CF_PROXIED_DEFAULT;

	if (!publicIPv6) {
		throw new Error("Missing required publicIPv6 argument");
	}

	for (const recordName of recordNames) {
		try {
			const existingRecord = await findAAAARecord({
				zoneId,
				name: recordName,
				token,
			});

			if (!existingRecord) {
				const created = await createAAAARecord({
					zoneId,
					name: recordName,
					token,
					ipv6: publicIPv6,
					proxied,
				});
				console.log(
					`${GREEN}${BOLD}[created]${RESET} ${CYAN}${created.name}${RESET} ${DIM}->${RESET} ${created.content} ${DIM}(id: ${created.id})${RESET}`
				);
				continue;
			}

			if (existingRecord.content === publicIPv6) {
				console.log(
					`${YELLOW}${BOLD}[no-op]${RESET} ${recordName} already points to ${publicIPv6}`
				);
				continue;
			}

			const updated = await updateAAAARecord({
				zoneId,
				recordId: existingRecord.id,
				token,
				name: recordName,
				ipv6: publicIPv6,
				proxied,
			});

			console.log(
				`${CYAN}${BOLD}[updated]${RESET} ${updated.name}: ${DIM}${existingRecord.content}${RESET} ${DIM}->${RESET} ${GREEN}${updated.content}${RESET}`
			);
		} catch (error) {
			console.error(
				`${RED}${BOLD}[error]${RESET} ${recordName}: ${error.message}`
			);
		}
	}
}
