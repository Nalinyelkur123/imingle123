// ============================================================================
// NexusChat — WebRTC Configuration & ICE Server Provider
// ============================================================================

import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ICEServer } from '../services/shared-types.js';

const router = Router();

export function getIceServers(): ICEServer[] {
  const servers: ICEServer[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
      ],
    },
  ];

  // If a valid production TURN server is configured (ignoring dummy localhost configs)
  const isRealTurnUrl =
    env.TURN_SERVER_URL &&
    !env.TURN_SERVER_URL.includes('localhost') &&
    !env.TURN_SERVER_URL.includes('127.0.0.1');

  if (isRealTurnUrl) {
    const urls = env.TURN_SERVER_URL!.split(',').map((u) => u.trim());
    const turnServer: ICEServer = { urls };
    if (env.TURN_USERNAME) turnServer.username = env.TURN_USERNAME;
    if (env.TURN_PASSWORD) turnServer.credential = env.TURN_PASSWORD;
    servers.push(turnServer);
  } else {
    // Provide OpenRelay public STUN/TURN fallback servers (UDP 80, UDP 443, TLS TCP 443)
    // to guarantee WebRTC NAT traversal across cellular CGNAT, Symmetric NAT, and different ISPs
    servers.push({
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turns:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelay',
      credential: 'openrelay',
    });
  }

  return servers;
}

router.get('/api/config/ice-servers', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    iceServers: getIceServers(),
  });
});

export default router;
