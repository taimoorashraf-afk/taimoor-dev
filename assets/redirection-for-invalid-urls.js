(function() {
    const invalidPagesForNonB2b = [
        '/products/tariff-charge'
    ];
    
    const currentPath = window.location.pathname;
    for (let i = 0; i < invalidPagesForNonB2b.length; i++) {
        if (currentPath.includes(invalidPagesForNonB2b[i])) {
            window.location.href = '/';
            return;
        }
    }
})();

