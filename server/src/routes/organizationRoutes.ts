import { Router, RequestHandler } from 'express';
import { organizationController } from '../controllers/organizationController';
import { authenticate } from '../middleware/auth';
import multer from 'multer';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for logos
  },
  fileFilter: (req, file, cb) => {
    // Allow only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Apply authentication middleware to all routes
router.use(authenticate as unknown as RequestHandler);

// Organization routes
router.get('/', asyncHandler(organizationController.getOrganizations) as unknown as RequestHandler);
router.post('/', upload.single('logo'), asyncHandler(organizationController.createOrganization) as unknown as RequestHandler);
router.put('/:id', upload.single('logo'), asyncHandler(organizationController.updateOrganization) as unknown as RequestHandler);
router.delete('/:id', asyncHandler(organizationController.deleteOrganization) as unknown as RequestHandler);

// Team routes
router.get('/:organizationId/teams', asyncHandler(organizationController.getOrganizationTeams) as unknown as RequestHandler);

// Category routes
router.get('/:organizationId/categories', asyncHandler(organizationController.getOrganizationCategories) as unknown as RequestHandler);

export default router; 