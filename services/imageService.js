// services/imageService.js
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { getPool, sql } = require('../config/database');

class ImageService {
    constructor() {
        this.uploadsDir = path.join(__dirname, '../uploads');
        this.publicUploadsDir = path.join(__dirname, '../public/uploads');
        this.initializeDirectories();
    }

    async initializeDirectories() {
        try {
            await fs.mkdir(this.uploadsDir, { recursive: true });
            await fs.mkdir(this.publicUploadsDir, { recursive: true });
            console.log('Upload directories initialized');
        } catch (error) {
            console.error('Error creating upload directories:', error);
        }
    }

    // Multer configuration for file uploads
    getMulterConfig() {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, this.uploadsDir);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                cb(null, 'img-' + uniqueSuffix + ext);
            }
        });

        const fileFilter = (req, file, cb) => {
            // Check file type - Only JPEG and PNG allowed
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file type. Only JPEG and PNG images are allowed.'), false);
            }
        };

        return multer({
            storage: storage,
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
                files: 2 // Maximum 2 files per upload
            },
            fileFilter: fileFilter
        });
    }

    // Process uploaded images (resize, optimize)
    async processImage(filePath, filename) {
        try {
            const outputPath = path.join(this.publicUploadsDir, filename);
            
            // Process image with Sharp
            await sharp(filePath)
                .resize(1200, 800, { 
                    fit: 'inside',
                    withoutEnlargement: true 
                })
                .jpeg({ 
                    quality: 85,
                    progressive: true 
                })
                .toFile(outputPath);

            // Create thumbnail
            const thumbnailFilename = 'thumb-' + filename.replace(path.extname(filename), '.jpg');
            const thumbnailPath = path.join(this.publicUploadsDir, thumbnailFilename);
            
            await sharp(filePath)
                .resize(300, 200, { 
                    fit: 'cover' 
                })
                .jpeg({ 
                    quality: 80 
                })
                .toFile(thumbnailPath);

            // Remove original uploaded file
            await fs.unlink(filePath);

            return {
                filename: filename.replace(path.extname(filename), '.jpg'),
                thumbnailFilename: thumbnailFilename,
                publicPath: `/uploads/${filename.replace(path.extname(filename), '.jpg')}`,
                thumbnailPath: `/uploads/${thumbnailFilename}`
            };
        } catch (error) {
            console.error('Error processing image:', error);
            throw new Error('Failed to process image');
        }
    }

    // Save image info to database
    async saveImageToDatabase(postId, imageData, caption = '') {
        try {
            const pool = getPool();
            const imageId = this.generateId();
            
            await pool.request()
                .input('ImageId', sql.NVarChar(50), imageId)
                .input('PostId', sql.NVarChar(50), postId)
                .input('Filename', sql.NVarChar(255), imageData.filename)
                .input('ThumbnailFilename', sql.NVarChar(255), imageData.thumbnailFilename)
                .input('PublicPath', sql.NVarChar(500), imageData.publicPath)
                .input('ThumbnailPath', sql.NVarChar(500), imageData.thumbnailPath)
                .input('Caption', sql.NVarChar(500), caption)
                .query(`
                    INSERT INTO PostImages (
                        id, post_id, filename, thumbnail_filename, 
                        public_path, thumbnail_path, caption, created_at
                    ) VALUES (
                        @ImageId, @PostId, @Filename, @ThumbnailFilename,
                        @PublicPath, @ThumbnailPath, @Caption, GETDATE()
                    )
                `);

            return { success: true, imageId };
        } catch (error) {
            console.error('Error saving image to database:', error);
            return { success: false, error: error.message };
        }
    }

    // Get images for a post
    async getPostImages(postId) {
        try {
            const pool = getPool();
            const result = await pool.request()
                .input('PostId', sql.NVarChar(50), postId)
                .query(`
                    SELECT * FROM PostImages 
                    WHERE post_id = @PostId 
                    ORDER BY created_at ASC
                `);

            return result.recordset;
        } catch (error) {
            console.error('Error fetching post images:', error);
            return [];
        }
    }

    // Delete image
    async deleteImage(imageId) {
        try {
            const pool = getPool();
            
            // Get image info before deleting
            const imageResult = await pool.request()
                .input('ImageId', sql.NVarChar(50), imageId)
                .query('SELECT * FROM PostImages WHERE id = @ImageId');

            if (imageResult.recordset.length === 0) {
                return { success: false, error: 'Image not found' };
            }

            const image = imageResult.recordset[0];

            // Delete files from filesystem
            try {
                const imagePath = path.join(this.publicUploadsDir, image.filename);
                const thumbnailPath = path.join(this.publicUploadsDir, image.thumbnail_filename);
                
                await fs.unlink(imagePath);
                await fs.unlink(thumbnailPath);
            } catch (fileError) {
                console.warn('Could not delete image files:', fileError.message);
            }

            // Delete from database
            await pool.request()
                .input('ImageId', sql.NVarChar(50), imageId)
                .query('DELETE FROM PostImages WHERE id = @ImageId');

            return { success: true };
        } catch (error) {
            console.error('Error deleting image:', error);
            return { success: false, error: error.message };
        }
    }

    // Clean up orphaned images (images without posts)
    async cleanupOrphanedImages() {
        try {
            const pool = getPool();
            const result = await pool.request().query(`
                SELECT pi.* FROM PostImages pi
                LEFT JOIN Posts p ON pi.post_id = p.id
                WHERE p.id IS NULL
            `);

            const orphanedImages = result.recordset;
            let deletedCount = 0;

            for (const image of orphanedImages) {
                const deleteResult = await this.deleteImage(image.id);
                if (deleteResult.success) {
                    deletedCount++;
                }
            }

            return { success: true, deletedCount };
        } catch (error) {
            console.error('Error cleaning up orphaned images:', error);
            return { success: false, error: error.message };
        }
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    // Get file size in human readable format
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Create singleton instance
const imageService = new ImageService();

module.exports = imageService;