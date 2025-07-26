// services/postService.js - Updated with image support
const { getPool, sql } = require('../config/database');
const imageService = require('./imageService');

class PostService {
    
    // Get all posts with optional filtering and images
    static async getAllPosts(includeInactive = false) {
        try {
            const pool = getPool();
            const result = await pool.request()
                .input('IncludeInactive', sql.Bit, includeInactive)
                .execute('GetOrderedPosts');
            
            const posts = result.recordset;
            
            // Get images for each post
            for (const post of posts) {
                post.images = await imageService.getPostImages(post.id);
            }
            
            return posts;
        } catch (error) {
            console.error('Error fetching posts:', error);
            throw new Error('Failed to fetch posts');
        }
    }

    // Get a single post by ID with images
    static async getPostById(id) {
        try {
            const pool = getPool();
            const result = await pool.request()
                .input('id', sql.NVarChar(50), id)
                .query('SELECT * FROM Posts WHERE id = @id');
            
            const post = result.recordset[0];
            if (post) {
                post.images = await imageService.getPostImages(post.id);
            }
            
            return post || null;
        } catch (error) {
            console.error('Error fetching post by ID:', error);
            throw new Error('Failed to fetch post');
        }
    }

    // Create a new post with image support
    static async createPost(title, content, adminUserId = null, imageFiles = []) {
        try {
            // Validate input
            const validation = this.validatePostData(title, content);
            if (!validation.isValid) {
                return { success: false, errors: validation.errors };
            }

            const pool = getPool();
            const id = this.generateId();
            
            // Create the post first
            await pool.request()
                .input('Id', sql.NVarChar(50), id)
                .input('Title', sql.NVarChar(255), title.trim())
                .input('Content', sql.NText, content.trim())
                .input('AdminUserId', sql.Int, adminUserId)
                .execute('CreatePost');
            
            // Process and save images if any
            const uploadedImages = [];
            if (imageFiles && imageFiles.length > 0) {
                for (const file of imageFiles) {
                    try {
                        // Process the image
                        const processedImage = await imageService.processImage(file.path, file.filename);
                        
                        // Save to database
                        const saveResult = await imageService.saveImageToDatabase(id, processedImage);
                        
                        if (saveResult.success) {
                            uploadedImages.push({
                                imageId: saveResult.imageId,
                                ...processedImage
                            });
                        }
                    } catch (imageError) {
                        console.error('Error processing image:', imageError);
                        // Continue with other images even if one fails
                    }
                }
            }
            
            return { 
                success: true, 
                id,
                uploadedImages: uploadedImages
            };
        } catch (error) {
            console.error('Error creating post:', error);
            return { success: false, error: error.message };
        }
    }

    // Update an existing post with image support
    static async updatePost(id, title, content, adminUserId = null, imageFiles = []) {
        try {
            // Validate input
            const validation = this.validatePostData(title, content);
            if (!validation.isValid) {
                return { success: false, errors: validation.errors };
            }

            const pool = getPool();
            
            // Update the post
            await pool.request()
                .input('Id', sql.NVarChar(50), id)
                .input('Title', sql.NVarChar(255), title.trim())
                .input('Content', sql.NText, content.trim())
                .input('AdminUserId', sql.Int, adminUserId)
                .execute('UpdatePost');
            
            // Process and save new images if any
            const uploadedImages = [];
            if (imageFiles && imageFiles.length > 0) {
                for (const file of imageFiles) {
                    try {
                        // Process the image
                        const processedImage = await imageService.processImage(file.path, file.filename);
                        
                        // Save to database
                        const saveResult = await imageService.saveImageToDatabase(id, processedImage);
                        
                        if (saveResult.success) {
                            uploadedImages.push({
                                imageId: saveResult.imageId,
                                ...processedImage
                            });
                        }
                    } catch (imageError) {
                        console.error('Error processing image:', imageError);
                        // Continue with other images even if one fails
                    }
                }
            }
            
            return { 
                success: true,
                uploadedImages: uploadedImages
            };
        } catch (error) {
            console.error('Error updating post:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete a post (images will be deleted via CASCADE)
    static async deletePost(id, adminUserId = null) {
        try {
            // Get post images before deletion for cleanup
            const images = await imageService.getPostImages(id);
            
            const pool = getPool();
            
            // Delete the post (CASCADE will handle PostImages table)
            await pool.request()
                .input('Id', sql.NVarChar(50), id)
                .input('AdminUserId', sql.Int, adminUserId)
                .execute('DeletePost');
            
            // Manually delete image files from filesystem
            for (const image of images) {
                await imageService.deleteImage(image.id);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting post:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete individual image from post
    static async deletePostImage(imageId, adminUserId = null) {
        try {
            const result = await imageService.deleteImage(imageId);
            return result;
        } catch (error) {
            console.error('Error deleting post image:', error);
            return { success: false, error: error.message };
        }
    }

    // Reorder posts
    static async reorderPosts(postIds) {
        try {
            if (!Array.isArray(postIds) || postIds.length === 0) {
                return { success: false, error: 'Invalid post IDs array' };
            }

            const pool = getPool();
            const idsString = postIds.join(',');
            
            await pool.request()
                .input('PostIds', sql.NVarChar(sql.MAX), idsString)
                .execute('ReorderPosts');
            
            return { success: true };
        } catch (error) {
            console.error('Error reordering posts:', error);
            return { success: false, error: error.message };
        }
    }

    // Validate post data
    static validatePostData(title, content) {
        const errors = [];
        
        if (!title || title.trim().length === 0) {
            errors.push('Title is required');
        }
        
        if (title && title.trim().length > 255) {
            errors.push('Title must be less than 255 characters');
        }
        
        if (!content || content.trim().length === 0) {
            errors.push('Content is required');
        }
        
        if (content && content.trim().length > 10000) {
            errors.push('Content must be less than 10,000 characters');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Generate unique ID
    static generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    // Get post statistics with image counts
    static async getPostStats() {
        try {
            const pool = getPool();
            const result = await pool.request().query(`
                SELECT 
                    COUNT(*) as total_posts,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_posts,
                    COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_posts,
                    MAX(created_at) as latest_post_date,
                    (SELECT COUNT(*) FROM PostImages) as total_images
                FROM Posts
            `);
            return result.recordset[0];
        } catch (error) {
            console.error('Error fetching post stats:', error);
            throw new Error('Failed to fetch post statistics');
        }
    }

    // Search posts with images
    static async searchPosts(query, includeInactive = false) {
        try {
            if (!query || query.trim().length === 0) {
                return [];
            }

            const pool = getPool();
            const searchTerm = `%${query.trim()}%`;
            
            const result = await pool.request()
                .input('searchTerm', sql.NVarChar(255), searchTerm)
                .input('includeInactive', sql.Bit, includeInactive)
                .query(`
                    SELECT * FROM Posts 
                    WHERE (title LIKE @searchTerm OR content LIKE @searchTerm)
                    AND (@includeInactive = 1 OR is_active = 1)
                    ORDER BY 
                        CASE WHEN display_order IS NOT NULL THEN display_order END,
                        created_at DESC
                `);
            
            const posts = result.recordset;
            
            // Get images for each post
            for (const post of posts) {
                post.images = await imageService.getPostImages(post.id);
            }
            
            return posts;
        } catch (error) {
            console.error('Error searching posts:', error);
            throw new Error('Failed to search posts');
        }
    }
}

module.exports = PostService;