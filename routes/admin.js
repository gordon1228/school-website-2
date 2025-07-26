// routes/admin.js - Updated with image upload support
const express = require('express');
const router = express.Router();
const PostService = require('../services/postService');
const imageService = require('../services/imageService');
const { requireAuth } = require('../middleware/auth');

// Configure multer for image uploads
const upload = imageService.getMulterConfig();

// Preserve post data on error
// This function will be used to ensure we keep the post data even if an error occurs during the update
async function preservePostDataOnError(postId, title, content) {
    try {
        const post = await PostService.getPostById(postId);
        if (post) {
            post.title = title || post.title;
            post.content = content || post.content;
            return post;
        }
    } catch (error) {
        console.error('Error preserving post data:', error);
    }
    
    // Fallback
    return { 
        id: postId, 
        title: title || '', 
        content: content || '',
        images: [] 
    };
}

// Admin dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
    console.log('=== DASHBOARD ACCESS ===');
    console.log('Session ID:', req.sessionID);
    console.log('Is authenticated:', req.session?.isAuthenticated);
    console.log('========================');
    
    try {
        const posts = await PostService.getAllPosts(true); // Include inactive posts for admin
        res.render('dashboard', { posts });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.render('dashboard', { posts: [] });
    }
});

// Create post page
router.get('/create', requireAuth, (req, res) => {
    res.render('create-post', { errors: null });
});

// Create post POST with image upload
router.post('/edit/:id', requireAuth, upload.array('images', 2), async (req, res) => {
    const { title, content } = req.body;
    const adminUserId = req.session.userId;
    const imageFiles = req.files || [];
    
    try {
        const result = await PostService.updatePost(req.params.id, title, content, adminUserId, imageFiles);
        
        if (result.success) {
            console.log(`Updated post with ${result.uploadedImages?.length || 0} new images`);
            res.redirect('/admin/dashboard');
        } else {
            // Handle validation errors
            if (result.errors) {
                // IMPORTANT: Get the full post data including existing images
                const post = await PostService.getPostById(req.params.id);
                if (post) {
                    // Update the post with the form data that was submitted
                    post.title = title || post.title;
                    post.content = content || post.content;
                    // Keep the existing images - this is the key fix!
                } else {
                    // Fallback if post not found
                    post = { 
                        id: req.params.id, 
                        title: title || '', 
                        content: content || '',
                        images: [] 
                    };
                }
                
                return res.status(400).render('edit-post', { 
                    post,
                    errors: result.errors
                });
            }
            res.status(500).send('Error updating post: ' + result.error);
        }
    } catch (error) {
        console.error('Error updating post:', error);
        // Preserve post data on error
        const post = await preservePostDataOnError(req.params.id, title, content);
        
        // Handle multer errors - also need to preserve existing images here
        if (error.code === 'LIMIT_FILE_SIZE') {
            const post = await PostService.getPostById(req.params.id);
            if (post) {
                post.title = title || post.title;
                post.content = content || post.content;
                // Existing images are preserved from getPostById
            }
            return res.status(400).render('edit-post', {
                post: post || { id: req.params.id, title: title || '', content: content || '', images: [] },
                errors: ['File size too large. Maximum size is 5MB per image.']
            });
        }
        
        if (error.code === 'LIMIT_FILE_COUNT') {
            const post = await PostService.getPostById(req.params.id);
            if (post) {
                post.title = title || post.title;
                post.content = content || post.content;
            }
            return res.status(400).render('edit-post', {
                post: post || { id: req.params.id, title: title || '', content: content || '', images: [] },
                errors: ['Too many files. Maximum 2 images per post.']
            });
        }
        
        if (error.message && error.message.includes('Invalid file type')) {
            const post = await PostService.getPostById(req.params.id);
            if (post) {
                post.title = title || post.title;
                post.content = content || post.content;
            }
            return res.status(400).render('edit-post', {
                post: post || { id: req.params.id, title: title || '', content: content || '', images: [] },
                errors: [error.message]
            });
        }
        
        res.status(500).send('Error updating post');
    }
});

// Edit post page
router.get('/edit/:id', requireAuth, async (req, res) => {
    try {
        const post = await PostService.getPostById(req.params.id);
        
        if (!post) {
            return res.status(404).send('Post not found');
        }
        
        res.render('edit-post', { post, errors: null });
    } catch (error) {
        console.error('Error loading edit page:', error);
        res.status(500).send('Error loading post');
    }
});

// Edit post POST with image upload
router.post('/edit/:id', requireAuth, upload.array('images', 2), async (req, res) => {
    const { title, content } = req.body;
    const adminUserId = req.session.userId;
    const imageFiles = req.files || [];
    
    try {
        const result = await PostService.updatePost(req.params.id, title, content, adminUserId, imageFiles);
        
        if (result.success) {
            console.log(`Updated post with ${result.uploadedImages?.length || 0} new images`);
            res.redirect('/admin/dashboard');
        } else {
            // Handle validation errors
            if (result.errors) {
                const post = { 
                    id: req.params.id, 
                    title: title || '', 
                    content: content || '',
                    images: [] 
                };
                return res.status(400).render('edit-post', { 
                    post,
                    errors: result.errors
                });
            }
            res.status(500).send('Error updating post: ' + result.error);
        }
    } catch (error) {
        console.error('Error updating post:', error);
        
        // Handle multer errors (same as create)
        if (error.code === 'LIMIT_FILE_SIZE') {
            const post = await PostService.getPostById(req.params.id);
            post.title = title || post.title;
            post.content = content || post.content;
            return res.status(400).render('edit-post', {
                post,
                errors: ['File size too large. Maximum size is 5MB per image.']
            });
        }
        
        res.status(500).send('Error updating post');
    }
});

// Delete individual image from post
router.post('/delete-image/:imageId', requireAuth, async (req, res) => {
    const adminUserId = req.session.userId;
    
    try {
        const result = await PostService.deletePostImage(req.params.imageId, adminUserId);
        
        if (result.success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ success: false, error: 'Failed to delete image' });
    }
});

// Reorder posts
router.post('/reorder', requireAuth, async (req, res) => {
    console.log('=== REORDER REQUEST ===');
    console.log('Session ID:', req.sessionID);
    console.log('Is authenticated:', req.session?.isAuthenticated);
    console.log('Body:', req.body);
    
    const { order } = req.body;

    try {
        const result = await PostService.reorderPosts(order);
        
        if (result.success) {
            console.log('Reorder successful');
            res.json({ success: true });
        } else {
            console.log('ERROR: Failed to reorder posts:', result.error);
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error reordering posts:', error);
        res.status(500).json({ success: false, error: 'Failed to reorder posts' });
    }
});

// Delete post
router.post('/delete/:id', requireAuth, async (req, res) => {
    const adminUserId = req.session.userId;
    
    try {
        const result = await PostService.deletePost(req.params.id, adminUserId);
        
        if (result.success) {
            res.redirect('/admin/dashboard');
        } else {
            res.status(500).send('Error deleting post: ' + result.error);
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).send('Error deleting post');
    }
});

// Get post statistics (API endpoint)
router.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const stats = await PostService.getPostStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
    }
});

// Cleanup orphaned images (admin utility)
router.post('/cleanup-images', requireAuth, async (req, res) => {
    try {
        const result = await imageService.cleanupOrphanedImages();
        
        if (result.success) {
            res.json({ 
                success: true, 
                message: `Cleaned up ${result.deletedCount} orphaned images` 
            });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error cleaning up images:', error);
        res.status(500).json({ success: false, error: 'Failed to cleanup images' });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;