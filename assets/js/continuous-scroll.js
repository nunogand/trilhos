// continuous-scroll.js
class BlogContinuousScroll {
    constructor() {
        this.posts = window.blogData.posts || [];
        this.currentPage = 1;
        this.postsPerPage = window.blogData.postsPerPage || 10;
        this.totalPosts = this.posts.length;
        this.isLoading = false;
        
        this.init();
    }
    
    init() {
        // Add scroll listener with throttling
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.handleScroll();
            }, 100);
        });
        
        // Track which posts are already loaded
        this.loadedPosts = new Set();
        
        // Mark initially loaded posts
        this.markInitialPosts();
    }
    
    markInitialPosts() {
        const initialCount = window.blogData.initialPosts || 10;
        for (let i = 0; i < initialCount && i < this.posts.length; i++) {
            this.loadedPosts.add(i);
        }
    }
    
    handleScroll() {
        const scrollPosition = window.scrollY + window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const threshold = 600; // Load more when 600px from bottom
        
        if (scrollPosition >= documentHeight - threshold && !this.isLoading) {
            this.loadMorePosts();
        }
    }
    
    loadMorePosts() {
        this.isLoading = true;
        this.showLoading();
        
        // Simulate loading delay for better UX
        setTimeout(() => {
            const startIndex = this.currentPage * this.postsPerPage;
            const endIndex = startIndex + this.postsPerPage;
            const postsToLoad = this.posts.slice(startIndex, endIndex);
            
            if (postsToLoad.length > 0) {
                this.appendPosts(postsToLoad);
                this.currentPage++;
                
                // Check if we've loaded all posts
                if (endIndex >= this.totalPosts) {
                    this.showEndMessage();
                }
            } else {
                this.showEndMessage();
            }
            
            this.hideLoading();
            this.isLoading = false;
        }, 500);
    }
    
    appendPosts(posts) {
        const container = document.getElementById('posts-container');
        
        posts.forEach(post => {
            // Check if post is already loaded
            if (this.loadedPosts.has(post.id)) return;
            
            const postElement = this.createPostElement(post);
            container.appendChild(postElement);
            this.loadedPosts.add(post.id);
            
            // Add fade-in animation
            postElement.style.opacity = '0';
            postElement.style.transform = 'translateY(20px)';
            requestAnimationFrame(() => {
                postElement.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                postElement.style.opacity = '1';
                postElement.style.transform = 'translateY(0)';
            });
        });
    }
    
    createPostElement(post) {
        const article = document.createElement('article');
        article.className = 'post-card';
        article.dataset.postId = post.id;
        
        // Use your existing card structure
        const cardHTML = this.generateCardHTML(post);
        article.innerHTML = cardHTML;
        
        return article;
    }
    
    generateCardHTML(post) {
        // Replicate your card_post_beta.html structure
        let html = `
            <div class="post-card">
                <div class="post-content">
                    <h2 class="post-title">
                        <a href="${post.url}">${post.title}</a>
                    </h2>
                    <p class="post-meta">${this.formatDate(post.date)}</p>
        `;
        
        if (post.excerpt) {
            html += `<p class="post-excerpt">${this.truncateText(post.excerpt, 25)}</p>`;
        }
        
        if (post.tags && post.tags.length > 0) {
            html += `<div class="post-tags">`;
            post.tags.forEach(tag => {
                html += `<span class="tag">${tag}</span>`;
            });
            html += `</div>`;
        }
        
        html += `
                    <a href="${post.url}" class="read-more">Ler mais</a>
                </div>
            </div>
        `;
        
        return html;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    truncateText(text, maxWords) {
        if (!text) return '';
        const words = text.split(' ');
        if (words.length <= maxWords) return text;
        return words.slice(0, maxWords).join(' ') + '...';
    }
    
    showLoading() {
        const loader = document.getElementById('loading-indicator');
        if (loader) loader.classList.remove('hidden');
    }
    
    hideLoading() {
        const loader = document.getElementById('loading-indicator');
        if (loader) loader.classList.add('hidden');
    }
    
    showEndMessage() {
        const endMessage = document.getElementById('end-message');
        if (endMessage) endMessage.classList.remove('hidden');
        
        // Remove scroll listener to prevent unnecessary calls
        window.removeEventListener('scroll', this.handleScroll);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we have a posts container
    if (document.getElementById('posts-container')) {
        new BlogContinuousScroll();
    }
});
