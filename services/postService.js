// services/postService.js - Updated with Categories support
const { getPool, sql } = require('../config/database');

class PostService {
    
    // Get all posts with category information
    static async getAllPosts(includeInactive = false) {
        try {
            const pool = getPool();
            const result = await pool.request()
                .input('IncludeInactive', sql.Bit, includeInactive)
                .execute('GetOrderedPostsWithCategories');
            return result.recordset;
        } catch (error) {
            console.error('Error fetching posts:', error);
            throw new Error('Failed to fetch posts');
        }
    }

    // Get posts by category
    static async getPostsByCategory(categorySlug, includeInactive = false) {
        try {
            const pool = getPool();
            const result = await pool.request()
                .input('CategorySlug', sql.NVarChar(100), categorySlug)
                .input('IncludeInactive', sql.Bit, includeInactive)
                .execute('GetPostsByCategory');
            return result.recordset;
        } catch (error) {
            console.error('Error fetching posts by category:', error);
            throw new Error('Failed to fetch posts by category');
        }
    }

    // Get a single post by ID with category info
    static async getPostById(id) {
        try {
            const pool = getPool();
            const result = await pool.request()
                .input('id', sql.NVarChar(50), id)
                .query(`
                    SELECT 
                        p.id, p.title, p.content, p.created_at as date, 
                        p.updated_at, p.is_active, p.display_order, p.category_id,
                        c.name as category_name, c.slug as category_slug, c.color as category_color
                    FROM Posts p
                    LEFT JOIN Categories c ON p.category_id = c.id
                    WHERE p.id = @id
                `);
            return result.recordset[0] || null;
        } catch (error) {
            console.error('Error fetching post by ID:', error);
            throw new Error('Failed to fetch post');
        }
    }

    // Create a new post with category
    static async createPost(title, content, categoryId = null, adminUserId = null) {
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
                .input('CategoryId', sql.Int, categoryId)
                .input('AdminUserId', sql.Int, adminUserId)
                .execute('CreatePost');
            
            return { success: true, id };
        } catch (error) {
            console.error('Error creating post:', error);
            return { success: false, error: error.message };
        }
    }

    // Update an existing post with category
    static async updatePost(id, title, content, categoryId = null, adminUserId = null) {
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
                .input('CategoryId', sql.Int, categoryId)
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

    // Get post statistics with category breakdown
    static async getPostStats() {
        try {
            const pool = getPool();
            const result = await pool.request().query(`
                SELECT 
                    COUNT(*) as total_posts,
                    COUNT(CASE WHEN p.is_active = 1 THEN 1 END) as active_posts,
                    COUNT(CASE WHEN p.is_active = 0 THEN 1 END) as inactive_posts,
                    MAX(p.created_at) as latest_post_date,
                    STRING_AGG(CONCAT(c.name, ': ', 
                        COUNT(CASE WHEN p.category_id = c.id AND p.is_active = 1 THEN 1 END)), ', ') as category_breakdown
                FROM Posts p
                LEFT JOIN Categories c ON p.category_id = c.id
                GROUP BY ()
            `);
            return result.recordset[0];
        } catch (error) {
            console.error('Error fetching post stats:', error);
            throw new Error('Failed to fetch post statistics');
        }
    }

    // Search posts with category filtering
    static async searchPosts(query, categorySlug = null, includeInactive = false) {
        try {
            if (!query || query.trim().length === 0) {
                return [];
            }

            const pool = getPool();
            const searchTerm = `%${query.trim()}%`;
            
            let whereClause = `WHERE (p.title LIKE @searchTerm OR p.content LIKE @searchTerm)
                AND (@includeInactive = 1 OR p.is_active = 1)`;
            
            if (categorySlug) {
                whereClause += ` AND c.slug = @categorySlug`;
            }
            
            const request = pool.request()
                .input('searchTerm', sql.NVarChar(255), searchTerm)
                .input('includeInactive', sql.Bit, includeInactive);
                
            if (categorySlug) {
                request.input('categorySlug', sql.NVarChar(100), categorySlug);
            }
            
            const result = await request.query(`
                SELECT 
                    p.id, p.title, p.content, p.created_at as date, 
                    p.updated_at, p.is_active, p.display_order, p.category_id,
                    c.name as category_name, c.slug as category_slug, c.color as category_color
                FROM Posts p 
                LEFT JOIN Categories c ON p.category_id = c.id
                ${whereClause}
                ORDER BY 
                    CASE WHEN p.display_order IS NOT NULL THEN p.display_order END,
                    p.created_at DESC
            `);
            
            return result.recordset;
        } catch (error) {
            console.error('Error searching posts:', error);
            throw new Error('Failed to search posts');
        }
    }

    // Category management methods
    static async getAllCategories() {
        try {
            const pool = getPool();
            const result = await pool.request().execute('GetAllCategories');
            return result.recordset;
        } catch (error) {
            console.error('Error fetching categories:', error);
            throw new Error('Failed to fetch categories');
        }
    }

    static async getCategoryBySlug(slug) {
        try {
            const pool = getPool();
            const result = await pool.request()
                .input('slug', sql.NVarChar(100), slug)
                .query('SELECT * FROM Categories WHERE slug = @slug AND is_active = 1');
            return result.recordset[0] || null;
        } catch (error) {
            console.error('Error fetching category by slug:', error);
            throw new Error('Failed to fetch category');
        }
    }

    static async getPostCountsByCategory() {
        try {
            const pool = getPool();
            const result = await pool.request().query(`
                SELECT 
                    c.id, c.name, c.slug, c.color,
                    COUNT(p.id) as post_count
                FROM Categories c
                LEFT JOIN Posts p ON c.id = p.category_id AND p.is_active = 1
                WHERE c.is_active = 1
                GROUP BY c.id, c.name, c.slug, c.color, c.display_order
                ORDER BY c.display_order, c.name
            `);
            return result.recordset;
        } catch (error) {
            console.error('Error fetching post counts by category:', error);
            throw new Error('Failed to fetch category post counts');
        }
    }
}

module.exports = PostService;