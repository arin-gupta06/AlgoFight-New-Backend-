import { execSync } from 'node:child_process';

try {
    const logs = execSync('docker logs algofight-piston-tunnel 2>&1', { encoding: 'utf8' });
    const match = logs.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
        console.log('\n=============================================');
        console.log('🔗 ACTIVE CLOUDFLARE PISTON TUNNEL URL:');
        console.log(match[0]);
        console.log('=============================================\n');
    } else {
        console.log('Tunnel URL not found yet in container logs. Wait a few seconds and try again.');
    }
} catch (err) {
    console.error('Failed to get docker logs for algofight-piston-tunnel:', err.message);
}
