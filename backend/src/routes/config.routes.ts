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
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
      ],
    },
  ];

  if (env.TURN_SERVER_URL) {
    const urls = env.TURN_SERVER_URL.split(',').map((u) => u.trim());
    const turnServer: ICEServer = { urls };
    if (env.TURN_USERNAME) turnServer.username = env.TURN_USERNAME;
    if (env.TURN_PASSWORD) turnServer.credential = env.TURN_PASSWORD;
    servers.push(turnServer);
  } else {
    // Development and public fallback: OpenRelay public STUN/TURN servers
    // Guarantees WebRTC connectivity across different Wi-Fi networks, cellular CGNAT, and Symmetric NAT environments
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
