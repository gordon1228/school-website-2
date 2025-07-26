// scripts/setup-images.js - Setup script for image functionality
const { connectDB, getPool, closeDB, sql } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

async function setupImageFunctionality() {
    console.log('🚀 Setting up image functionality...\n');
    
    try {
        // 1. Connect to database
        console.log('1. Connecting to database...');
        await connectDB();
        console.log('✅ Database connected\n');
        
        // 2. Create PostImages table
        console.log('2. Creating PostImages table...');
        const pool = getPool();
        
        // Check if table already exists
        const tableCheck = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'PostImages'
        `);
        
        if (tableCheck.recordset.length > 0) {
            console.log('⚠️  PostImages table already exists, skipping creation');
        } else {
            await pool.request().query(`
                CREATE TABLE PostImages (
                    id NVARCHAR(50) PRIMARY KEY,
                    post_id NVARCHAR(50) NOT NULL,
                    filename NVARCHAR(255) NOT NULL,
                    thumbnail_filename NVARCHAR(255) NOT NULL,
                    public_path NVARCHAR(500) NOT NULL,
                    thumbnail_path NVARCHAR(500) NOT NULL,
                    caption NVARCHAR(500) NULL,
                    created_at DATETIME2 DEFAULT GETDATE(),
                    
                    -- Foreign key constraint
                    CONSTRAINT FK_PostImages_Posts 
                        FOREIGN KEY (post_id) REFERENCES Posts(id) 
                        ON DELETE CASCADE
                );
            `);
            
            // Create indexes
            await pool.request().query(`
                CREATE INDEX IX_PostImages_PostId ON PostImages(post_id);
            `);
            
            await pool.request().query(`
                CREATE INDEX IX_PostImages_CreatedAt ON PostImages(created_at);
            `);
            
            console.log('✅ PostImages table created with indexes');
        }
        
        // 3. Create upload directories
        console.log('\n3. Creating upload directories...');
        const uploadsDir = path.join(__dirname, '../uploads');
        const publicUploadsDir = path.join(__dirname, '../public/uploads');
        
        try {
            await fs.mkdir(uploadsDir, { recursive: true });
            console.log('✅ Created uploads directory:', uploadsDir);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
            console.log('ℹ️  Uploads directory already exists');
        }
        
        try {
            await fs.mkdir(publicUploadsDir, { recursive: true });
            console.log('✅ Created public uploads directory:', publicUploadsDir);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
            console.log('ℹ️  Public uploads directory already exists');
        }
        
        // 4. Create .gitignore for uploads if it doesn't exist
        console.log('\n4. Setting up .gitignore for uploads...');
        const gitignorePath = path.join(__dirname, '../.gitignore');
        
        try {
            let gitignoreContent = '';
            try {
                gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
            } catch (error) {
                // File doesn't exist, that's fine
            }
            
            const uploadsIgnore = '\n# Upload directories\nuploads/\npublic/uploads/*.jpg\npublic/uploads/*.jpeg\npublic/uploads/*.png\npublic/uploads/*.gif\n!public/uploads/.gitkeep\n';
            
            if (!gitignoreContent.includes('uploads/')) {
                await fs.writeFile(gitignorePath, gitignoreContent + uploadsIgnore);
                console.log('✅ Updated .gitignore with upload directories');
            } else {
                console.log('ℹ️  .gitignore already configured for uploads');
            }
        } catch (error) {
            console.warn('⚠️  Could not update .gitignore:', error.message);
        }
        
        // 5. Create .gitkeep files
        console.log('\n5. Creating .gitkeep files...');
        try {
            await fs.writeFile(path.join(uploadsDir, '.gitkeep'), '');
            await fs.writeFile(path.join(publicUploadsDir, '.gitkeep'), '');
            console.log('✅ Created .gitkeep files');
        } catch (error) {
            console.warn('⚠️  Could not create .gitkeep files:', error.message);
        }
        
        // 6. Test database functionality
        console.log('\n6. Testing database functionality...');
        const testResult = await pool.request().query(`
            SELECT 
                COUNT(*) as post_count,
                (SELECT COUNT(*) FROM PostImages) as image_count
            FROM Posts
        `);
        
        console.log('✅ Database test successful');
        console.log(`   - Posts: ${testResult.recordset[0].post_count}`);
        console.log(`   - Images: ${testResult.recordset[0].image_count}`);
        
        console.log('\n🎉 Image functionality setup completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('   1. Run: npm install multer sharp');
        console.log('   2. Restart your application');
        console.log('   3. Test image upload by creating a new post');
        console.log('\n💡 Tips:');
        console.log('   - Supported formats: JPEG, PNG, GIF');
        console.log('   - Maximum file size: 5MB per image');
        console.log('   - Maximum images per post: 5');
        console.log('   - Images are automatically resized and optimized');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Make sure your database is running');
        console.log('   2. Check your .env file configuration');
        console.log('   3. Ensure you have write permissions for the upload directories');
        process.exit(1);
    } finally {
        await closeDB();
    }
}

// Run the setup
if (require.main === module) {
    setupImageFunctionality();
}

module.exports = { setupImageFunctionality };