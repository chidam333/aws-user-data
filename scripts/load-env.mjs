import { execSync } from 'child_process';
import { RED, GREEN, RESET } from './colors.mjs';

const PARAMS = [
  '/ec2-user/cloudfare-api-token',
  '/ec2-user/cloudfare-zone-id',
  '/ec2-user/hosted-domains',
  '/ec2-user/tailscale-auth-key',
  '/ec2-user/resend-api-token',
];

const REGION = 'ap-south-2';
const ENDPOINT = 'https://ssm.ap-south-2.api.aws';

const envMap = {
  '/ec2-user/cloudfare-api-token': 'CF_API_TOKEN',
  '/ec2-user/cloudfare-zone-id': 'CF_ZONE_ID',
  '/ec2-user/hosted-domains': 'CF_RECORD_NAMES',
  '/ec2-user/tailscale-auth-key': 'TAILSCALE_AUTH_KEY',
  '/ec2-user/resend-api-token': 'RESEND_API_TOKEN',
};

const paramNames = PARAMS.join(' ');
const cmd = `aws ssm get-parameters --names ${paramNames} --region ${REGION} --endpoint-url ${ENDPOINT} --with-decryption --output json`;

try {
  const result = execSync(cmd, { encoding: 'utf8' });
  const { Parameters } = JSON.parse(result);

  if (!Parameters || Parameters.length === 0) {
    console.error(`${RED}ERROR: No parameters returned from SSM${RESET}`);
    process.exit(1);
  }

  for (const param of Parameters) {
    const envVar = envMap[param.Name];
    if (envVar) {
      console.log(`export ${envVar}="${param.Value}"`);
    }
  }

  console.error(`${GREEN}SUCCESS: Loaded environment variables from SSM${RESET}`);
} catch (err) {
  console.error(`${RED}ERROR: Failed to load SSM parameters: ${err.message}${RESET}`);
  process.exit(1);
}