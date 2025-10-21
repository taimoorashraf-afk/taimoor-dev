(function() {
    // Use const for better performance and prevent accidental reassignment
    const invalidPagesForNonB2b = [
        '/projects',
        '/search',
        '/cart',
    ];
    
    // Get the current path once and cache it
    const currentPath = window.location.pathname;
    
    // Use a more efficient loop with early termination
    // This is faster than .some() for small arrays and allows early exit
    for (let i = 0; i < invalidPagesForNonB2b.length; i++) {
        if (currentPath.includes(invalidPagesForNonB2b[i])) {
            // Use replace() instead of href for faster redirection
            window.location.href = '/customer_authentication/login?return_to=%2Fpages%2Fconfigurators';
            return; // Early exit to prevent further execution
        }
    }
})();

