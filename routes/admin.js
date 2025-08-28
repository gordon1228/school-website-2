// routes/admin.js - Updated with Categories support
const express = require('express');
const router = express.Router();
const PostService = require('../services/postService');
const { requireAuth } = require('../middleware/auth');

// Admin dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
    console.log('=== DASHBOARD ACCESS ===');
    console.log('Session ID:', req.sessionID);
    console.log('Is authenticated:', req.session?.isAuthenticated);
    console.log('========================');
    
    try {
        const posts = await PostService.getAllPosts(true); // Include inactive posts for admin
        const categories = await PostService.getAllCategories();
        res.render('dashboard', { posts, categories });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.render('dashboard', { posts: [], categories: [] });
    }
});

// Create post page
router.get('/create', requireAuth, async (req, res) => {
    try {
        const categories = await PostService.getAllCategories();
        res.render('create-post', { categories, errors: null, title: '', content: '', category_id: '' });
    } catch (error) {
        console.error('Error loading create page:', error);
        res.render('create-post', { categories: [], errors: null, title: '', content: '', category_id: '' });
    }
});

// Create post POST
router.post('/create', requireAuth, async (req, res) => {
    const { title, content, category_id } = req.body;
    const adminUserId = req.session.userId;
    
    try {
        const categoryId = category_id && category_id !== '' ? parseInt(category_id) : null;
        const result = await PostService.createPost(title, content, categoryId, adminUserId);
        
        if (result.success) {
            res.redirect('/admin/dashboard');
        } else {
            // Handle validation errors
            if (result.errors) {
                const categories = await PostService.getAllCategories();
                return res.status(400).render('create-post', { 
                    categories,
                    errors: result.errors,
                    title: title || '',
                    content: content || '',
                    category_id: category_id || ''
                });
            }
            res.status(500).send('Error creating post: ' + result.error);
        }
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).send('Error creating post');
    }
});

// Edit post page
router.get('/edit/:id', requireAuth, async (req, res) => {
    try {
        const post = await PostService.getPostById(req.params.id);
        const categories = await PostService.getAllCategories();
        
        if (!post) {
            return res.status(404).send('Post not found');
        }
        
        res.render('edit-post', { post, categories, errors: null });
    } catch (error) {
        console.error('Error loading edit page:', error);
        res.status(500).send('Error loading post');
    }
});

// Edit post POST
router.post('/edit/:id', requireAuth, async (req, res) => {
    const { title, content, category_id } = req.body;
    const adminUserId = req.session.userId;
    
    try {
        const categoryId = category_id && category_id !== '' ? parseInt(category_id) : null;
        const result = await PostService.updatePost(req.params.id, title, content, categoryId, adminUserId);
        
        if (result.success) {
            res.redirect('/admin/dashboard');
        } else {
            // Handle validation errors
            if (result.errors) {
                const categories = await PostService.getAllCategories();
                const post = { 
                    id: req.params.id, 
                    title: title || '', 
                    content: content || '',
                    category_id: categoryId
                };
                return res.status(400).render('edit-post', { 
                    post,
                    categories,
                    errors: result.errors
                });
            }
            res.status(500).send('Error updating post: ' + result.error);
        }
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).send('Error updating post');
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
        const categoryStats = await PostService.getPostCountsByCategory();
        res.json({ success: true, stats, categoryStats });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
    }
});

// Category management routes
router.get('/categories', requireAuth, async (req, res) => {
    try {
        const categories = await PostService.getPostCountsByCategory();
        res.render('categories', { categories });
    } catch (error) {
        console.error('Error loading categories:', error);
        res.render('categories', { categories: [] });
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