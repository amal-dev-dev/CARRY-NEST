
import multer from 'multer';
import cloudinary from '../Config/cloudinary.js';

const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

const storage = {
    _handleFile(req, file, cb) {
        let completed = false;

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'carry_nest_profiles',
                resource_type: 'image',
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
            },
            (error, result) => {
                if (completed) return;
                completed = true;

                if (error) {
                    return cb(error);
                }

                cb(null, {
                    path: result.secure_url,
                    filename: result.public_id,
                    public_id: result.public_id,
                    size: result.bytes
                });
            }
        );

        file.stream.on('error', (error) => {
            if (completed) return;
            completed = true;
            uploadStream.destroy(error);
            cb(error);
        });

        uploadStream.on('error', (error) => {
            if (completed) return;
            completed = true;
            cb(error);
        });

        file.stream.pipe(uploadStream);
    },

    async _removeFile(req, file, cb) {
        try {
            if (file.filename) {
                await cloudinary.uploader.destroy(
                    file.filename,
                    { resource_type: 'image' }
                );
            }

            delete file.path;
            delete file.filename;
            delete file.public_id;
            delete file.size;

            cb(null);
        } catch (error) {
            cb(error);
        }
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: 2 * 1024 * 1024
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
