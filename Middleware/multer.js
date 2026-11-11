
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../Config/cloudinary.js';

const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

const storage = new CloudinaryStorage({
    cloudinary,

    params: {
        folder: 'carry_nest_profiles',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: 2 * 1024 * 1024 // 2 MB
    },

    fileFilter: (req, file, cb) => {

        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(
                new Error('Only JPG, JPEG, PNG and WEBP images are allowed')
            );
        }

        cb(null, true);
    }
});

export default upload;
