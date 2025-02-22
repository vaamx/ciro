import multer from 'multer';
import { Request } from 'express';
import path from 'path';
import { getOrganizationUploadPath, ensureOrganizationUploadDir } from '../utils/upload';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req: Request, _file: Express.Multer.File, cb) => {
    const organizationId = req.params.organizationId || req.body.organizationId;
    if (!organizationId) {
      return cb(new Error('Organization ID is required'), '');
    }

    try {
      const uploadPath = getOrganizationUploadPath(Number(organizationId));
      await ensureOrganizationUploadDir(Number(organizationId));
      cb(null, uploadPath);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to allow only certain file types
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/csv'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, PDF, and CSV files are allowed.'));
  }
};

// Export configured multer middleware
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
}); 