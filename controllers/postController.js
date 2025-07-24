// controllers/postController.js
const PostService = require('../services/postService');

class PostController {
    static async getHomepage(req, res) {
        try {
            const posts = await PostService.getAllPosts(false);
            res.render('index', { posts });
        } catch (error) {
            console.error('Error loading homepage:', error);
            res.render('index', { posts: [] });
        }
    }
    
    // Add more controller methods as needed
}

module.exports = PostController;