import { execSync } from 'child_process';

const PARAMS = [
  '/ec2-user/cloudfare-api-token',
  '/ec2-user/cloudfare-zone-id',
  '/ec2-user/hosted-domains',
  '/ec2-user/tailscale-auth-key',
  '/ec2-user/resend-api-token',
];

const REGION = 'ap-south-2';

const paramNames = PARAMS.map(p => `"${p}"`).join(' ');

const cmd = `aws ssm get-parameters --names ${paramNames} --region ${REGION} --with-decryption --output json`;

const result = execSync(cmd, { encoding: 'utf8' });
const { Parameters } = JSON.parse(result);

const envMap = {
  '/ec2-user/cloudfare-api-token': 'CF_API_TOKEN',
  '/ec2-user/cloudfare-zone-id': 'CF_ZONE_ID',
  '/ec2-user/hosted-domains': 'CF_RECORD_NAMES',
  '/ec2-user/tailscale-auth-key': 'TAILSCALE_AUTH_KEY',
  '/ec2-user/resend-api-token': 'RESEND_API_TOKEN',
};

for (const param of Parameters) {
  const envVar = envMap[param.Name];
  if (envVar) {
    // this will log the variables which in @user-data.sh will be evalled to set the environment variables
    console.log(`export ${envVar}="${param.Value}"`);
  }
}