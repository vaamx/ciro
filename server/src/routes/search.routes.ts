import { Router } from '../types/express-types';
import { SearchController } from '../controllers/search.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { RequestHandler } from '../types/express-types';

const router = Router();
const searchController = new SearchController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Search routes
router.get('/similar', asyncHandler(searchController.searchSimilarDocuments.bind(searchController)) as RequestHandler);
router.get('/files', asyncHandler(searchController.getUserFiles.bind(searchController)) as RequestHandler);

export default router; 