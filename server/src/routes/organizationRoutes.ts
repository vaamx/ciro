import { Router } from 'express';
import { organizationController } from '../controllers/organizationController';
import { authenticate } from '../middleware/auth';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler';

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
router.use(authenticate);

// Organization routes
router.get('/', asyncHandler(organizationController.getOrganizations));
router.post('/', upload.single('logo'), asyncHandler(organizationController.createOrganization));
router.put('/:id', upload.single('logo'), asyncHandler(organizationController.updateOrganization));
router.delete('/:id', asyncHandler(organizationController.deleteOrganization));

// Team routes
router.get('/:organizationId/teams', asyncHandler(organizationController.getOrganizationTeams));

// Category routes
router.get('/:organizationId/categories', asyncHandler(organizationController.getOrganizationCategories));

export default router; 