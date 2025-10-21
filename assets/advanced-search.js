// advanced-search.js - Add this to your theme's assets folder

class AdvancedSearchHandler {
    constructor() {
      this.storefrontAccessToken = 'YOUR_STOREFRONT_ACCESS_TOKEN'; // Replace with your token
      this.shopDomain = 'YOUR_SHOP.myshopify.com'; // Replace with your domain
      this.searchContainer = document.getElementById('advanced-search-results');
      this.searchInput = document.getElementById('Search-In-Template');
      this.filters = {};
    }
  
    // GraphQL query for product search with filters
    getSearchQuery(searchTerm, filters = {}) {
      const filterString = this.buildFilterString(filters);
      
      return `
        query SearchProducts($searchTerm: String!, $exactSearchTerm: String!) {
          # Exact matches - search in title and SKU
          exactMatches: products(
            first: 20,
            query: $exactSearchTerm
            ${filterString ? `, ${filterString}` : ''}
          ) {
            edges {
              node {
                id
                title
                handle
                vendor
                productType
                tags
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
                images(first: 2) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      sku
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
          
          # Similar matches - broader search
          similarMatches: products(
            first: 20,
            query: $searchTerm
            ${filterString ? `, ${filterString}` : ''}
          ) {
            edges {
              node {
                id
                title
                handle
                vendor
                productType
                tags
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
                images(first: 2) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      sku
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;
    }
  
    // Build filter string from filter object
    buildFilterString(filters) {
      const filterParts = [];
      
      if (filters.productType) {
        filterParts.push(`product_type:${filters.productType}`);
      }
      
      if (filters.vendor) {
        filterParts.push(`vendor:${filters.vendor}`);
      }
      
      if (filters.minPrice || filters.maxPrice) {
        const min = filters.minPrice || 0;
        const max = filters.maxPrice || 999999;
        filterParts.push(`variants.price:>=${min} AND variants.price:<=${max}`);
      }
      
      if (filters.tags && filters.tags.length > 0) {
        filters.tags.forEach(tag => {
          filterParts.push(`tag:${tag}`);
        });
      }
      
      return filterParts.length > 0 ? `filter: "${filterParts.join(' AND ')}"` : '';
    }
  
    // Perform the search using GraphQL
    async performSearch(searchTerm) {
      if (!searchTerm || searchTerm.trim() === '') {
        return { exactMatches: [], similarMatches: [] };
      }
  
      const exactSearchTerm = `title:*${searchTerm}* OR sku:*${searchTerm}*`;
      const similarSearchTerm = searchTerm;
  
      const query = this.getSearchQuery(similarSearchTerm, this.filters);
      
      try {
        const response = await fetch(`https://${this.shopDomain}/api/2023-10/graphql.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': this.storefrontAccessToken
          },
          body: JSON.stringify({
            query: query,
            variables: {
              searchTerm: similarSearchTerm,
              exactSearchTerm: exactSearchTerm
            }
          })
        });
  
        const data = await response.json();
        
        if (data.errors) {
          console.error('GraphQL errors:', data.errors);
          return { exactMatches: [], similarMatches: [] };
        }
  
        // Process and categorize results
        const results = this.categorizeResults(
          data.data.exactMatches.edges,
          data.data.similarMatches.edges,
          searchTerm
        );
  
        return results;
      } catch (error) {
        console.error('Search error:', error);
        return { exactMatches: [], similarMatches: [] };
      }
    }
  
    // Categorize results into exact and similar matches
    categorizeResults(exactResults, similarResults, searchTerm) {
      const searchTermLower = searchTerm.toLowerCase();
      const searchWords = searchTermLower.split(' ').filter(word => word.length > 0);
      
      const exactMatches = [];
      const similarMatches = [];
      const processedIds = new Set();
  
      // Process exact matches first
      exactResults.forEach(({ node: product }) => {
        const titleLower = product.title.toLowerCase();
        const sku = product.variants.edges[0]?.node.sku?.toLowerCase() || '';
        const vendorLower = product.vendor.toLowerCase();
        
        // Check for exact criteria
        const isExactMatch = 
          titleLower === searchTermLower || // Exact title match
          sku === searchTermLower || // Exact SKU match
          vendorLower === searchTermLower || // Exact vendor match
          (searchWords.every(word => titleLower.includes(word)) && searchWords.length > 1); // All words present
        
        if (isExactMatch && !processedIds.has(product.id)) {
          exactMatches.push(product);
          processedIds.add(product.id);
        }
      });
  
      // Process similar matches (exclude already processed exact matches)
      similarResults.forEach(({ node: product }) => {
        if (!processedIds.has(product.id)) {
          const titleLower = product.title.toLowerCase();
          const relevanceScore = this.calculateRelevance(titleLower, searchWords);
          
          if (relevanceScore > 0) {
            product.relevanceScore = relevanceScore;
            similarMatches.push(product);
            processedIds.add(product.id);
          }
        }
      });
  
      // Sort similar matches by relevance
      similarMatches.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
      return { exactMatches, similarMatches };
    }
  
    // Calculate relevance score for similar matches
    calculateRelevance(title, searchWords) {
      let score = 0;
      
      searchWords.forEach(word => {
        if (title.includes(word)) {
          score += 1;
          // Bonus for word at beginning of title
          if (title.startsWith(word)) {
            score += 0.5;
          }
        }
      });
      
      return score;
    }
  
    // Render the search results
    renderResults(results) {
      if (!this.searchContainer) return;
  
      let html = '';
  
      // Render exact matches section
      if (results.exactMatches.length > 0) {
        html += `
          <div class="search-results-section">
            <div class="search-results-section__header">
              <h2>Exact Matches <span class="result-count">(${results.exactMatches.length} results)</span></h2>
            </div>
            <div class="product-grid">
              ${results.exactMatches.map(product => this.renderProductCard(product)).join('')}
            </div>
          </div>
        `;
      }
  
      // Render similar matches section
      if (results.similarMatches.length > 0) {
        html += `
          <div class="search-results-section">
            <div class="search-results-section__header">
              <h2>Similar Results <span class="result-count">(${results.similarMatches.length} results)</span></h2>
            </div>
            <div class="product-grid">
              ${results.similarMatches.map(product => this.renderProductCard(product)).join('')}
            </div>
          </div>
        `;
      }
  
      // Show no results message if both sections are empty
      if (results.exactMatches.length === 0 && results.similarMatches.length === 0) {
        html = '<div class="no-results">No results found. Please try a different search term.</div>';
      }
  
      this.searchContainer.innerHTML = html;
    }
  
    // Render individual product card
    renderProductCard(product) {
      const imageUrl = product.images.edges[0]?.node.url || '/placeholder-image.jpg';
      const price = product.priceRange.minVariantPrice.amount;
      const currency = product.priceRange.minVariantPrice.currencyCode;
      
      return `
        <div class="product-card">
          <a href="/products/${product.handle}" class="product-card__link">
            <div class="product-card__image">
              <img src="${imageUrl}" alt="${product.title}" loading="lazy">
            </div>
            <div class="product-card__info">
              <h3 class="product-card__title">${product.title}</h3>
              <p class="product-card__vendor">${product.vendor}</p>
              <p class="product-card__price">${this.formatPrice(price, currency)}</p>
            </div>
          </a>
        </div>
      `;
    }
  
    // Format price for display
    formatPrice(amount, currencyCode) {
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode
      });
      return formatter.format(amount);
    }
  
    // Handle filter updates
    updateFilters(newFilters) {
      this.filters = { ...this.filters, ...newFilters };
      const searchTerm = this.searchInput?.value || '';
      if (searchTerm) {
        this.search(searchTerm);
      }
    }
  
    // Main search method
    async search(searchTerm) {
      // Show loading state
      if (this.searchContainer) {
        this.searchContainer.innerHTML = '<div class="loading">Searching...</div>';
      }
  
      // Perform search
      const results = await this.performSearch(searchTerm);
      
      // Render results
      this.renderResults(results);
    }
  
    // Initialize the search handler
    init() {
      // Listen to search form submission
      const searchForm = document.querySelector('.search');
      if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const searchTerm = this.searchInput?.value || '';
          this.search(searchTerm);
        });
      }
  
      // Listen to filter changes (if using Search & Discovery app)
      document.addEventListener('filter:updated', (e) => {
        this.updateFilters(e.detail.filters);
      });
  
      // Perform initial search if there's a search term in URL
      const urlParams = new URLSearchParams(window.location.search);
      const searchTerm = urlParams.get('q');
      if (searchTerm) {
        this.search(searchTerm);
      }
    }
  }
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    const searchHandler = new AdvancedSearchHandler();
    searchHandler.init();
  });
  
  // CSS to add to your theme
  const styles = `
  <style>
  .search-results-section {
    margin-bottom: 3rem;
    padding: 0 1rem;
  }
  
  .search-results-section__header {
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #e5e5e5;
  }
  
  .search-results-section__header h2 {
    font-size: 1.75rem;
    font-weight: 600;
    color: #333;
  }
  
  .result-count {
    font-size: 1rem;
    font-weight: 400;
    color: #666;
    margin-left: 0.5rem;
  }
  
  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 2rem;
  }
  
  .product-card {
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    border: 1px solid #e5e5e5;
  }
  
  .product-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  }
  
  .product-card__link {
    text-decoration: none;
    color: inherit;
    display: block;
  }
  
  .product-card__image {
    aspect-ratio: 1;
    overflow: hidden;
    background: #f5f5f5;
  }
  
  .product-card__image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }
  
  .product-card:hover .product-card__image img {
    transform: scale(1.05);
  }
  
  .product-card__info {
    padding: 1rem;
  }
  
  .product-card__title {
    font-size: 1rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #333;
  }
  
  .product-card__vendor {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.5rem;
  }
  
  .product-card__price {
    font-size: 1.125rem;
    font-weight: 600;
    color: #000;
  }
  
  .loading {
    text-align: center;
    padding: 3rem;
    font-size: 1.125rem;
    color: #666;
  }
  
  .no-results {
    text-align: center;
    padding: 4rem 2rem;
    font-size: 1.125rem;
    color: #666;
  }
  
  @media (max-width: 768px) {
    .product-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1rem;
    }
  }
  </style>
  `;