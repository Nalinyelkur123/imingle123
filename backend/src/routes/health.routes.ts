// ============================================================================
// NexusChat — Health Routes
// ============================================================================

import { Router } from 'express';
import { healthCheck } from '../controllers/health.controller.js';

const router = Router();

router.get('/health', healthCheck);
router.get('/api/health', healthCheck);

export default router;
