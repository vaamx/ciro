import { Router } from 'express';
import authRoutes from './auth.routes';
import dataSourceRoutes from './data-source.routes';
import fileRoutes from './file.routes';
import searchRoutes from './search.routes';
import documentProcessingRoutes from './document-processing.routes';

const router = Router();

// Apply routes
router.use('/auth', authRoutes);
router.use('/data-sources', dataSourceRoutes);
router.use('/files', fileRoutes);
router.use('/search', searchRoutes);
router.use('/document-processing', documentProcessingRoutes);

export default router; 