import { readFileSync, existsSync, writeFileSync } from 'fs';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { getRequiredEnv } from './utilities/getRequiredEnv.mjs';
import { RED, GREEN, YELLOW, CYAN, RESET, BOLD } from './colors.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCK_FILE = '/var/run/email_status_sent';
const NGINX_SITES_DIR = join(__dirname, 'nginx', 'sites-available');
const CLOUD_INIT_LOG = '/var/log/cloud-init-output.log';
const RESEND_FROM_EMAIL = 'ec2-status@chidam.xyz';
const RESEND_TO_EMAIL = 'chidam.sync@gmail.com';

function checkLockFile() {
	try {
		if (existsSync(LOCK_FILE)) {
			console.log(`${YELLOW}Lock file exists, exiting${RESET}`);
			process.exit(0);
		}
	} catch (err) {
		console.log(`${YELLOW}Could not check lock file: ${err.message}${RESET}`);
	}
}

function createLockFileSync() {
	try {
		writeFileSync(LOCK_FILE, new Date().toISOString());
	} catch (err) {
		console.log('Could not create lock file:', err.message);
	}
}

function getNginxDomains() {
	const files = readdirSync(NGINX_SITES_DIR);
	const domains = [];
	for (const file of files) {
		if (file.endsWith('.conf')) {
			const domain = file.replace('.conf', '');
			domains.push(domain);
		}
	}
	return domains;
}

async function checkSiteStatus(domain) {
	const protocol = 'https';
	const url = `${protocol}://${domain}`;
	const start = performance.now();
	
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000);
		
		const response = await fetch(url, {
			method: 'HEAD',
			signal: controller.signal,
			redirect: 'follow'
		});
		
		clearTimeout(timeoutId);
		const status = response.status;
		const latency = Math.round(performance.now() - start);
		
		return {
			domain,
			url,
			status,
			accessible: status >= 200 && status < 400,
			latency
		};
	} catch (err) {
		const latency = Math.round(performance.now() - start);
		return {
			domain,
			url,
			status: 0,
			accessible: false,
			error: err.message,
			latency
		};
	}
}

function readCloudInitLog() {
	try {
		if (existsSync(CLOUD_INIT_LOG)) {
			return readFileSync(CLOUD_INIT_LOG, 'utf8');
		}
		return null;
	} catch (err) {
		return null;
	}
}

function base64Encode(str) {
	return Buffer.from(str).toString('base64');
}

async function sendEmail(apiToken, htmlContent, attachmentContent, attachmentFilename) {
	const body = {
		from: RESEND_FROM_EMAIL,
		to: [RESEND_TO_EMAIL],
		subject: `System Status Report - ${new Date().toISOString().split('T')[0]}`,
		html: htmlContent,
		attachments: [
			{
				filename: attachmentFilename,
				content: base64Encode(attachmentContent)
			}
		]
	};

	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Resend API error: ${response.status} - ${error}`);
	}

	return await response.json();
}

function generateHtmlReport(siteResults, logContent) {
	const rows = siteResults.map(site => {
		const statusIcon = site.accessible ? '[OK]' : '[FAIL]';
		const statusText = site.accessible ? 'Accessible' : 'Failed';
		const statusColor = site.accessible ? 'green' : 'red';
		const latency = site.latency ? `${site.latency}ms` : '-';
		const errorInfo = site.error ? `<br><small style="color: gray">${site.error}</small>` : '';
		
		return `
			<tr>
				<td style="padding: 8px; border: 1px solid #ddd;">${site.domain}</td>
				<td style="padding: 8px; border: 1px solid #ddd;">${site.url}</td>
				<td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">${statusIcon} ${statusText}</td>
				<td style="padding: 8px; border: 1px solid #ddd;">${site.status || '-'}</td>
				<td style="padding: 8px; border: 1px solid #ddd;">${latency}</td>
				<td style="padding: 8px; border: 1px solid #ddd;">${site.status >= 200 && site.status < 300 ? 'OK' : '-'}${errorInfo}</td>
			</tr>
		`;
	}).join('');

	const allAccessible = siteResults.every(s => s.accessible);
	const summaryColor = allAccessible ? 'green' : 'orange';
	const summaryText = allAccessible ? 'All sites are accessible!' : 'Some sites are not accessible';

	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>System Status Report</title>
	<style>
		body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
		.container { max-width: 900px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
		h1 { color: #333; }
		.summary { padding: 15px; background-color: #f0f0f0; border-radius: 5px; margin-bottom: 20px; }
		.summary h2 { margin-top: 0; color: ${summaryColor}; }
		table { width: 100%; border-collapse: collapse; margin-top: 20px; }
		th { background-color: #4a90d9; color: white; padding: 12px; text-align: left; }
		.timestamp { color: gray; font-size: 14px; }
	</style>
</head>
<body>
	<div class="container">
		<h1>System Status Report</h1>
		<div class="summary">
			<h2>${summaryText}</h2>
			<p class="timestamp">Generated at: ${new Date().toISOString()}</p>
		</div>
		
		<h3>Site Availability</h3>
		<table>
			<tr>
				<th>Domain</th>
				<th>URL</th>
				<th>Status</th>
				<th>HTTP Code</th>
				<th>Latency</th>
				<th>SSL</th>
			</tr>
			${rows}
		</table>
		
		<h3>Notes</h3>
		<p>Full cloud-init log attached as <code>cloud-init-output.log</code></p>
	</div>
</body>
</html>
	`;
}

async function main() {
	checkLockFile();

	const apiToken = getRequiredEnv('RESEND_API_TOKEN');
	const domains = getNginxDomains();
	
	console.log(`${CYAN}Checking ${domains.length} site(s)...${RESET}`);
	
	const siteResults = await Promise.all(domains.map(d => checkSiteStatus(d)));
	
	for (const result of siteResults) {
		const icon = result.accessible ? `${GREEN}[OK]` : `${RED}[FAIL]`;
		const status = result.accessible ? `${GREEN}OK${RESET}` : `${RED}FAILED${RESET}`;
		console.log(`${icon}${RESET} ${result.domain}: ${status} (${result.latency}ms)`);
	}
	
	const logContent = readCloudInitLog() || 'Log file not found';
	const htmlContent = generateHtmlReport(siteResults, logContent);
	
	console.log(`${YELLOW}Sending email...${RESET}`);
	await sendEmail(apiToken, htmlContent, logContent, 'cloud-init-output.log');
	console.log(`${GREEN}${BOLD}Email sent successfully!${RESET}`);
	
	createLockFileSync();
}

main().catch((error) => {
	console.error(`${RED}Error: ${error.message}${RESET}`);
	process.exit(1);
});