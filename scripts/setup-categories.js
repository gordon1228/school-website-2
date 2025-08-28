// scripts/setup-categories.js
// Run this script to set up the categories feature
const { connectDB, getPool, closeDB, sql } = require('../config/database');

async function setupCategories() {
    try {
        console.log('🚀 Setting up Categories feature...\n');
        
        await connectDB();
        const pool = getPool();
        
        // Step 1: Create Categories table
        console.log('📋 Step 1: Creating Categories table...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Categories' AND xtype='U')
            CREATE TABLE Categories (
                id INT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(100) NOT NULL UNIQUE,
                slug NVARCHAR(100) NOT NULL UNIQUE,
                description NVARCHAR(500) NULL,
                color NVARCHAR(7) DEFAULT '#007bff',
                display_order INT DEFAULT 0,
                is_active BIT DEFAULT 1,
                created_at DATETIME2 DEFAULT GETDATE(),
                updated_at DATETIME2 DEFAULT GETDATE()
            );
        `);
        console.log('✅ Categories table created/verified\n');
        
        // Step 2: Add category_id to Posts table
        console.log('📋 Step 2: Adding category_id column to Posts table...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                          WHERE TABLE_NAME = 'Posts' AND COLUMN_NAME = 'category_id')
            BEGIN
                ALTER TABLE Posts ADD category_id INT NULL;
                ALTER TABLE Posts ADD CONSTRAINT FK_Posts_Categories 
                    FOREIGN KEY (category_id) REFERENCES Categories(id);
            END
        `);
        console.log('✅ Posts table updated with category support\n');
        
        // Step 3: Insert default categories
        console.log('📋 Step 3: Creating default categories...');
        const defaultCategories = [
            { name: 'General', slug: 'general', description: 'General announcements and updates', color: '#6c757d', order: 1 },
            { name: 'Academic', slug: 'academic', description: 'Academic news and educational updates', color: '#28a745', order: 2 },
            { name: 'Events', slug: 'events', description: 'School events and activities', color: '#fd7e14', order: 3 },
            { name: 'Sports', slug: 'sports', description: 'Sports news and athletic achievements', color: '#dc3545', order: 4 },
            { name: 'Administration', slug: 'administration', description: 'Administrative notices and policies', color: '#6f42c1', order: 5 }
        ];
        
        for (const category of defaultCategories) {
            try {
                await pool.request()
                    .input('name', sql.NVarChar(100), category.name)
                    .input('slug', sql.NVarChar(100), category.slug)
                    .input('description', sql.NVarChar(500), category.description)
                    .input('color', sql.NVarChar(7), category.color)
                    .input('display_order', sql.Int, category.order)
                    .query(`
                        IF NOT EXISTS (SELECT 1 FROM Categories WHERE slug = @slug)
                        INSERT INTO Categories (name, slug, description, color, display_order)
                        VALUES (@name, @slug, @description, @color, @display_order)
                    `);
                console.log(`   ✅ ${category.name} category created`);
            } catch (err) {
                console.log(`   ⚠️  ${category.name} category already exists or error occurred`);
            }
        }
        console.log('');
        
        // Step 4: Update existing posts to have default category
        console.log('📋 Step 4: Assigning default category to existing posts...');
        const result = await pool.request().query(`
            UPDATE Posts 
            SET category_id = (SELECT id FROM Categories WHERE slug = 'general')
            WHERE category_id IS NULL
        `);
        console.log(`✅ Updated ${result.rowsAffected[0]} existing posts with default category\n`);
        
        // Step 5: Create/Update stored procedures
        console.log('📋 Step 5: Creating stored procedures...');
        
        // GetAllCategories procedure
        await pool.request().query(`
            CREATE OR ALTER PROCEDURE GetAllCategories
            AS
            BEGIN
                SELECT id, name, slug, description, color, display_order, is_active
                FROM Categories
                WHERE is_active = 1
                ORDER BY display_order, name;
            END;
        `);
        console.log('   ✅ GetAllCategories procedure created');
        
        // GetOrderedPostsWithCategories procedure
        await pool.request().query(`
            CREATE OR ALTER PROCEDURE GetOrderedPostsWithCategories
                @IncludeInactive BIT = 0
            AS
            BEGIN
                SELECT 
                    p.id,
                    p.title,
                    p.content,
                    p.created_at as date,
                    p.updated_at,
                    p.is_active,
                    p.display_order,
                    p.category_id,
                    c.name as category_name,
                    c.slug as category_slug,
                    c.color as category_color
                FROM Posts p
                LEFT JOIN Categories c ON p.category_id = c.id
                WHERE (@IncludeInactive = 1 OR p.is_active = 1)
                ORDER BY 
                    CASE WHEN p.display_order IS NOT NULL THEN p.display_order END,
                    p.created_at DESC;
            END;
        `);
        console.log('   ✅ GetOrderedPostsWithCategories procedure created');
        
        // GetPostsByCategory procedure
        await pool.request().query(`
            CREATE OR ALTER PROCEDURE GetPostsByCategory
                @CategorySlug NVARCHAR(100),
                @IncludeInactive BIT = 0
            AS
            BEGIN
                SELECT 
                    p.id,
                    p.title,
                    p.content,
                    p.created_at as date,
                    p.updated_at,
                    p.is_active,
                    p.display_order,
                    p.category_id,
                    c.name as category_name,
                    c.slug as category_slug,
                    c.color as category_color
                FROM Posts p
                INNER JOIN Categories c ON p.category_id = c.id
                WHERE c.slug = @CategorySlug
                AND (@IncludeInactive = 1 OR p.is_active = 1)
                ORDER BY 
                    CASE WHEN p.display_order IS NOT NULL THEN p.display_order END,
                    p.created_at DESC;
            END;
        `);
        console.log('   ✅ GetPostsByCategory procedure created');
        
        // Update CreatePost procedure
        await pool.request().query(`
            CREATE OR ALTER PROCEDURE CreatePost
                @Id NVARCHAR(50),
                @Title NVARCHAR(255),
                @Content NTEXT,
                @CategoryId INT = NULL,
                @AdminUserId INT = NULL
            AS
            BEGIN
                SET NOCOUNT ON;
                
                DECLARE @MaxOrder INT;
                SELECT @MaxOrder = ISNULL(MAX(display_order), 0) FROM Posts;
                
                INSERT INTO Posts (id, title, content, category_id, display_order, created_at, updated_at, is_active)
                VALUES (@Id, @Title, @Content, @CategoryId, @MaxOrder + 1, GETDATE(), GETDATE(), 1);
                
                -- Log activity if admin user provided
                IF @AdminUserId IS NOT NULL AND EXISTS (SELECT 1 FROM sysobjects WHERE name='ActivityLog' AND xtype='U')
                BEGIN
                    INSERT INTO ActivityLog (admin_user_id, action, details, timestamp)
                    VALUES (@AdminUserId, 'CREATE', 'Created post: ' + @Title, GETDATE());
                END
            END;
        `);
        console.log('   ✅ CreatePost procedure updated');
        
        // Update UpdatePost procedure
        await pool.request().query(`
            CREATE OR ALTER PROCEDURE UpdatePost
                @Id NVARCHAR(50),
                @Title NVARCHAR(255),
                @Content NTEXT,
                @CategoryId INT = NULL,
                @AdminUserId INT = NULL
            AS
            BEGIN
                SET NOCOUNT ON;
                
                UPDATE Posts 
                SET title = @Title, 
                    content = @Content, 
                    category_id = @CategoryId,
                    updated_at = GETDATE()
                WHERE id = @Id;
                
                -- Log activity if admin user provided
                IF @AdminUserId IS NOT NULL AND EXISTS (SELECT 1 FROM sysobjects WHERE name='ActivityLog' AND xtype='U')
                BEGIN
                    INSERT INTO ActivityLog (admin_user_id, action, details, timestamp)
                    VALUES (@AdminUserId, 'UPDATE', 'Updated post: ' + @Title, GETDATE());
                END
            END;
        `);
        console.log('   ✅ UpdatePost procedure updated\n');
        
        // Step 6: Test the setup
        console.log('📋 Step 6: Testing the setup...');
        const categories = await pool.request().execute('GetAllCategories');
        console.log(`✅ Found ${categories.recordset.length} categories`);
        
        const posts = await pool.request()
            .input('IncludeInactive', sql.Bit, true)
            .execute('GetOrderedPostsWithCategories');
        console.log(`✅ Found ${posts.recordset.length} posts with category information\n`);
        
        // Success summary
        console.log('🎉 Categories feature setup completed successfully!\n');
        console.log('📊 Summary:');
        console.log(`   • Categories table: Created/Verified`);
        console.log(`   • Posts table: Updated with category support`);
        console.log(`   • Default categories: ${categories.recordset.length} created`);
        console.log(`   • Stored procedures: Updated for category support`);
        console.log(`   • Existing posts: Updated with default category\n`);
        
        console.log('🔗 Next steps:');
        console.log('   1. Update your PostService.js file with the new version');
        console.log('   2. Update your admin.js and public.js routes');
        console.log('   3. Update your EJS view files');
        console.log('   4. Restart your application');
        console.log('   5. Visit /admin/categories to manage categories\n');
        
        console.log('✨ Your school website now has full category support!');
        
    } catch (error) {
        console.error('❌ Error setting up categories:', error);
        throw error;
    } finally {
        await closeDB();
    }
}

// Run the setup
if (require.main === module) {
    setupCategories()
        .then(() => {
            console.log('\n🚀 Setup completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Setup failed:', error.message);
            process.exit(1);
        });
}

module.exports = { setupCategories };