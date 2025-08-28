// routes/public.js - Updated with Categories support
const express = require('express');
const router = express.Router();
const PostService = require('../services/postService');

// Public homepage
router.get('/', async (req, res) => {
    try {
        const posts = await PostService.getAllPosts(false); // Only active posts
        const categories = await PostService.getPostCountsByCategory();
        res.render('index', { posts, categories });
    } catch (error) {
        console.error('Error loading homepage:', error);
        res.render('index', { posts: [], categories: [] });
    }
});

// Posts by category
router.get('/category/:slug', async (req, res) => {
    try {
        const categorySlug = req.params.slug;
        const category = await PostService.getCategoryBySlug(categorySlug);
        
        if (!category) {
            return res.status(404).render('404', { message: 'Category not found' });
        }
        
        const posts = await PostService.getPostsByCategory(categorySlug, false);
        const categories = await PostService.getPostCountsByCategory();
        
        res.render('category', { posts, categories, currentCategory: category });
    } catch (error) {
        console.error('Error loading category page:', error);
        res.status(500).send('Error loading category');
    }
});

// API endpoint for posts (for potential future use)
router.get('/api/posts', async (req, res) => {
    try {
        const categorySlug = req.query.category;
        let posts;
        
        if (categorySlug) {
            posts = await PostService.getPostsByCategory(categorySlug, false);
        } else {
            posts = await PostService.getAllPosts(false);
        }
        
        res.json({ success: true, posts });
    } catch (error) {
        console.error('Error fetching posts API:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch posts' });
    }
});

// Search posts
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        const categorySlug = req.query.category;
        
        if (!query) {
            return res.redirect('/');
        }
        
        const posts = await PostService.searchPosts(query, categorySlug, false);
        const categories = await PostService.getPostCountsByCategory();
        
        res.render('search-results', { 
            posts, 
            categories, 
            query, 
            selectedCategory: categorySlug 
        });
    } catch (error) {
        console.error('Error searching posts:', error);
        res.render('search-results', { 
            posts: [], 
            categories: [],
            query: req.query.q || '',
            selectedCategory: req.query.category || ''
        });
    }
});

// Individual post view (optional feature)
router.get('/post/:id', async (req, res) => {
    try {
        const post = await PostService.getPostById(req.params.id);
        
        if (!post || !post.is_active) {
            return res.status(404).render('404', { message: 'Post not found' });
        }
        
        res.render('post-detail', { post });
    } catch (error) {
        console.error('Error loading post:', error);
        res.status(500).send('Error loading post');
    }
});

module.exports = router;