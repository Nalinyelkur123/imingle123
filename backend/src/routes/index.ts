// ============================================================================
// NexusChat — Route Aggregator
// ============================================================================

import { Router } from 'express';
import healthRoutes from './health.routes.js';
import statsRoutes from './stats.routes.js';
import reportRoutes from './report.routes.js';
import sessionRoutes from './session.routes.js';
import detectionRoutes from './detection.routes.js';

const router = Router();

router.use(healthRoutes);
router.use(statsRoutes);
router.use(reportRoutes);
router.use(sessionRoutes);
router.use('/api/detection', detectionRoutes);

export default router;
