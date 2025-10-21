window.shopifyHelpers = window.shopifyHelpers || {};

function handleQuantityChange (value) {
    // Default options
    const cleanValue = value.toString().replace(/[^0-9]/g, '');

    return cleanValue;
};

function isValueValid(value, min = 1, max = 9999) {
    let num = parseFloat(value);
    if (isNaN(num) || value === "" || value === null) {
        return { valid: false, error: "Value is required and must be a number." };
    }
    if (num < min) {
        return { valid: false, error: `Value must be at least ${min}.` };
    }
    if (num > max) {
        return { valid: false, error: `Value must not exceed ${max}.` };
    }
    return { valid: true, error: null };
}

function formatPrice(price) {
    const formatted = (price / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `$ ${formatted}`;
}

window.shopifyHelpers.handleQuantityChange = handleQuantityChange
window.shopifyHelpers.isValueValid = isValueValid
window.shopifyHelpers.formatPrice = formatPrice


