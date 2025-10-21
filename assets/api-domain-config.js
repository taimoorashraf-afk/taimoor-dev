// Global API Domain Configuration
// This file manages API domains for different environments
// Place this file in your assets folder as: api-domain-config.js

window.apiDomainConfig = {
  "https://dmfluxury.com": "https://dmstaging2.codupcloud.com", // Production site → Production API
  "https://dmf-uat.myshopify.com": "https://dmstaging2.codupcloud.com", // Production site → Production API  
  "https://dmf-luxury-20-uat.myshopify.com": "https://stg-dmlight.codupcloud.com" // Staging site → Staging API
};

// Helper function to get the current API domain
window.getApiDomain = function() {
  const currentOrigin = window.location.origin;
  return window.apiDomainConfig[currentOrigin] || "https://dmstaging2.codupcloud.com"; // fallback to production
};

// Helper function to build API URLs
window.buildApiUrl = function(endpoint) {
  const apiDomain = window.getApiDomain();
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  return `${apiDomain}/${cleanEndpoint}`;
};

// Optional: Debug function to check current configuration
window.debugApiConfig = function() {
  console.log('Current Origin:', window.location.origin);
  console.log('Selected API Domain:', window.getApiDomain());
  console.log('All Configurations:', window.apiDomainConfig);
};