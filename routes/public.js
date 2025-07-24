// routes/public.js - Fixed to use consistent PostService method names
const express = require('express');
const router = express.Router();
const PostService = require('../services/postService');

// Public homepage
router.get('/', async (req, res) => {
    try {
        const posts = await PostService.getAllPosts(false); // Only active posts
        res.render('index', { posts });
    } catch (error) {
        console.error('Error loading homepage:', error);
        res.render('index', { posts: [] });
    }
});

// API endpoint for posts (for potential future use)
router.get('/api/posts', async (req, res) => {
    try {
        const posts = await PostService.getAllPosts(false);
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
        if (!query) {
            return res.redirect('/');
        }
        
        const posts = await PostService.searchPosts(query, false);
        res.render('search-results', { posts, query });
    } catch (error) {
        console.error('Error searching posts:', error);
        res.render('search-results', { posts: [], query: req.query.q || '' });
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