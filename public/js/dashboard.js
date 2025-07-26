// public/js/dashboard.js - Updated with better session handling
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize SortableJS if we're on the dashboard page
    const sortableElement = document.getElementById('sortable-posts');
    const saveOrderBtn = document.getElementById('save-order-btn');
    
    if (sortableElement && saveOrderBtn) {
        let hasUnsavedChanges = false;
        let originalOrder = [];
        
        // Store the original order when page loads
        function storeOriginalOrder() {
            originalOrder = Array.from(sortableElement.querySelectorAll('tr[data-id]'))
                .map(row => row.dataset.id);
            console.log('Original order stored:', originalOrder);
        }
        
        // Check if current order differs from original
        function checkForChanges() {
            const currentOrder = Array.from(sortableElement.querySelectorAll('tr[data-id]'))
                .map(row => row.dataset.id);
            
            const hasChanges = JSON.stringify(originalOrder) !== JSON.stringify(currentOrder);
            console.log('Original:', originalOrder);
            console.log('Current:', currentOrder);
            console.log('Has changes:', hasChanges);
            
            if (hasChanges !== hasUnsavedChanges) {
                hasUnsavedChanges = hasChanges;
                updateSaveButton(hasChanges);
            }
        }
        
        // Update row numbers after reordering
        function updateRowNumbers() {
            const rows = sortableElement.querySelectorAll('tr[data-id]');
            rows.forEach((row, index) => {
                const orderCell = row.querySelector('td:first-child small');
                if (orderCell) {
                    orderCell.textContent = `#${index + 1}`;
                }
            });
        }
        
        // Initialize original order
        storeOriginalOrder();
        
        // Initialize SortableJS with better options
        const sortable = new Sortable(sortableElement, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.fa-grip-vertical',
            onStart: function(evt) {
                console.log('Drag started');
                document.body.style.cursor = 'grabbing';
            },
            onEnd: function(evt) {
                console.log('Drag ended - Old index:', evt.oldIndex, 'New index:', evt.newIndex);
                document.body.style.cursor = '';
                
                // Update row numbers
                updateRowNumbers();
                
                // Check for changes (with a small delay to ensure DOM is updated)
                setTimeout(checkForChanges, 10);
            }
        });

        // Update save button appearance based on changes
        function updateSaveButton(hasChanges) {
            console.log('Updating save button, has changes:', hasChanges);
            
            if (hasChanges) {
                saveOrderBtn.disabled = false;
                saveOrderBtn.classList.remove('btn-outline-success', 'btn-success', 'btn-danger');
                saveOrderBtn.classList.add('btn-warning');
                saveOrderBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Save Changes';
            } else {
                saveOrderBtn.disabled = true;
                saveOrderBtn.classList.remove('btn-warning', 'btn-success', 'btn-danger');
                saveOrderBtn.classList.add('btn-outline-success');
                saveOrderBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Post Order';
            }
        }
        
        // Initialize button state
        updateSaveButton(false);

        // UPDATED: Save button click handler with better session handling
        saveOrderBtn.addEventListener('click', function() {
            console.log('Save button clicked, hasUnsavedChanges:', hasUnsavedChanges);
            
            if (!hasUnsavedChanges) {
                console.log('No changes to save');
                return;
            }

            const orderedIds = Array.from(sortableElement.querySelectorAll('tr[data-id]'))
                .map(row => row.dataset.id);
            
            console.log('Sending order to server:', orderedIds);

            // Show loading state
            saveOrderBtn.disabled = true;
            saveOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';

            fetch('/admin/reorder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add these headers to help with session handling
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin', // Important: Include cookies/session
                body: JSON.stringify({ order: orderedIds })
            })
            .then(response => {
                console.log('Server response status:', response.status);
                console.log('Server response headers:', [...response.headers.entries()]);
                
                // Handle different response types
                const contentType = response.headers.get('content-type') || '';
                console.log('Response content-type:', contentType);
                
                // Check if we got an unauthorized response (session expired)
                if (response.status === 401) {
                    throw new Error('Session expired');
                }
                
                // Check if we got redirected to login (HTML response when expecting JSON)
                if (contentType.includes('text/html')) {
                    console.log('Got HTML response when expecting JSON - likely redirected to login');
                    throw new Error('Session expired - redirected to login');
                }
                
                // Check for other errors
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                // Ensure we have JSON response
                if (!contentType.includes('application/json')) {
                    throw new Error('Expected JSON response but got: ' + contentType);
                }
                
                return response.json();
            })
            .then(data => {
                console.log('Server response data:', data);
                
                // Handle server-side session check
                if (data.redirect && data.redirect.includes('login')) {
                    throw new Error('Session expired');
                }
                
                if (data.success) {
                    // Success state
                    hasUnsavedChanges = false;
                    originalOrder = [...orderedIds]; // Update original order
                    
                    saveOrderBtn.classList.remove('btn-warning');
                    saveOrderBtn.classList.add('btn-success');
                    saveOrderBtn.innerHTML = '<i class="fas fa-check me-2"></i>Saved Successfully!';
                    
                    // Reset button after 2 seconds
                    setTimeout(() => {
                        updateSaveButton(false);
                    }, 2000);
                    
                } else {
                    throw new Error(data.error || 'Failed to save post order');
                }
            })
            .catch(error => {
                console.error('Error saving post order:', error);
                
                // Check for session expiry
                if (error.message.includes('Session expired') || 
                    error.message.includes('Authentication required') ||
                    error.message.includes('redirected to login')) {
                    
                    alert('Your session has expired. You will be redirected to the login page.');
                    window.location.href = '/admin/login';
                    return;
                }
                
                // Error state
                saveOrderBtn.classList.remove('btn-warning');
                saveOrderBtn.classList.add('btn-danger');
                saveOrderBtn.innerHTML = '<i class="fas fa-times me-2"></i>Save Failed';
                
                // Show error message
                alert('Error saving post order: ' + error.message);
                
                // Reset button after 3 seconds
                setTimeout(() => {
                    updateSaveButton(true); // Keep as warning since changes weren't saved
                }, 3000);
            });
        });
        

        // Add custom styles for SortableJS
        const style = document.createElement('style');
        style.textContent = `
            .sortable-ghost {
                opacity: 0.4;
                background-color: rgba(0, 123, 255, 0.1);
            }
            
            .sortable-chosen {
                background-color: rgba(0, 123, 255, 0.05);
            }
            
            .sortable-drag {
                transform: rotate(5deg);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            }
            
            #sortable-posts tr {
                transition: background-color 0.2s ease;
            }
            
            #sortable-posts tr:hover {
                background-color: rgba(0, 0, 0, 0.02);
            }
            
            .fa-grip-vertical {
                cursor: grab;
                color: #6c757d;
                transition: color 0.2s ease;
            }
            
            .fa-grip-vertical:hover {
                color: #495057;
            }
            
            .fa-grip-vertical:active {
                cursor: grabbing;
            }
            
            /* Make save button more visible when changes are pending */
            .btn-warning {
                animation: pulse-warning 2s infinite;
            }
            
            @keyframes pulse-warning {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        console.log('Dashboard drag & drop initialized successfully');
    }

    
});


// Function to open image modal
// This function is used to display images in a modal when clicked
function openImageModal(imageSrc) {
    document.getElementById('modalImage').src = imageSrc;
    const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
    imageModal.show();
}

// Add smooth hover effects
document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('.post-images img');
    images.forEach(img => {
        img.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.02)';
            this.style.transition = 'transform 0.2s ease';
        });
        
        img.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
});