// services/PostService.js - Single source of truth for all post operations
const { getPool, sql } = require('../config/database');

class PostService {
    
    // Get all posts with optional filtering
    static async getAllPosts(includeInactive = false) {
        try {
            const pool = getPool();
            const result = await pool.request()
                .input('IncludeInactive', sql.Bit, includeInactive)
                .execute('GetOrderedPosts');
            return result.recordset;
        } catch (error) {
            console.error('Error fetching posts:', error);
            throw new Error('Failed to fetch posts');
        }
    }

    // Get a single post by ID
    static async getPostById(id) {
        try {
            const pool = getPool();
            const result = await pool.request()
                .input('id', sql.NVarChar(50), id)
                .query('SELECT * FROM Posts WHERE id = @id');
            return result.recordset[0] || null;
        } catch (error) {
            console.error('Error fetching post by ID:', error);
            throw new Error('Failed to fetch post');
        }
    }

    // Create a new post
    static async createPost(title, content, adminUserId = null) {
        try {
            // Validate input
            const validation = this.validatePostData(title, content);
            if (!validation.isValid) {
                return { success: false, errors: validation.errors };
            }

            const pool = getPool();
            const id = this.generateId();
            
            await pool.request()
                .input('Id', sql.NVarChar(50), id)
                .input('Title', sql.NVarChar(255), title.trim())
                .input('Content', sql.NText, content.trim())
                .input('AdminUserId', sql.Int, adminUserId)
                .execute('CreatePost');
            
            return { success: true, id };
        } catch (error) {
            console.error('Error creating post:', error);
            return { success: false, error: error.message };
        }
    }

    // Update an existing post
    static async updatePost(id, title, content, adminUserId = null) {
        try {
            // Validate input
            const validation = this.validatePostData(title, content);
            if (!validation.isValid) {
                return { success: false, errors: validation.errors };
            }

            const pool = getPool();
            
            await pool.request()
                .input('Id', sql.NVarChar(50), id)
                .input('Title', sql.NVarChar(255), title.trim())
                .input('Content', sql.NText, content.trim())
                .input('AdminUserId', sql.Int, adminUserId)
                .execute('UpdatePost');
            
            return { success: true };
        } catch (error) {
            console.error('Error updating post:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete a post
    static async deletePost(id, adminUserId = null) {
        try {
            const pool = getPool();
            
            await pool.request()
                .input('Id', sql.NVarChar(50), id)
                .input('AdminUserId', sql.Int, adminUserId)
                .execute('DeletePost');
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting post:', error);
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

    // Get post statistics
    static async getPostStats() {
        try {
            const pool = getPool();
            const result = await pool.request().query(`
                SELECT 
                    COUNT(*) as total_posts,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_posts,
                    COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_posts,
                    MAX(created_at) as latest_post_date
                FROM Posts
            `);
            return result.recordset[0];
        } catch (error) {
            console.error('Error fetching post stats:', error);
            throw new Error('Failed to fetch post statistics');
        }
    }

    // Search posts
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
            
            return result.recordset;
        } catch (error) {
            console.error('Error searching posts:', error);
            throw new Error('Failed to search posts');
        }
    }
}

module.exports = PostService;