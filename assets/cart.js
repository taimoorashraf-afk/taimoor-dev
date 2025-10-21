class PrintCartButon extends HTMLElement {
  formatPrice(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
  constructor() {
    super();

    // Load html2pdf library
    this.loadHTML2PDF();

    // New dropdown functionality
    const printTrigger = this.querySelector('.print-trigger-btn');
    const printDropdown = this.querySelector('.print-dropdown');
    const printWrapper = this.querySelector('.print-options-wrapper');

    if (printTrigger && printDropdown) {
      printTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        printWrapper.classList.toggle('active');
        printDropdown.classList.toggle('show');
      });

      document.addEventListener('click', (e) => {
        if (!printWrapper.contains(e.target)) {
          printWrapper.classList.remove('active');
          printDropdown.classList.remove('show');
        }
      });
    }

    const printOptionBtns = this.querySelectorAll('.print-option-btn');
    printOptionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const printType = btn.getAttribute('data-print-type');
        this.printCart(printType);
        
        printWrapper.classList.remove('active');
        printDropdown.classList.remove('show');
      });
    });

    // Original single print button
    this.printButton = this.querySelector('[print-cart-button]');
    this.printButton?.addEventListener('click', () => {
      this.printCart('dealer-po'); // Default to dealer-po
    });
  }

  loadHTML2PDF() {
    if (!document.querySelector('#html2pdf-script')) {
      const script = document.createElement('script');
      script.id = 'html2pdf-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      document.head.appendChild(script);
    }
  }

  debugCartData() {
  // Check if cart data from Liquid is available
  const cartDataElement = document.querySelector('#cart-data-formatted');
  if (cartDataElement) {
    const cartDataAttr = cartDataElement.getAttribute('cartData');
    if (cartDataAttr) {
      try {
        const parsedCartData = JSON.parse(cartDataAttr);
        if (parsedCartData.cart && parsedCartData.cart.items) {
          parsedCartData.cart.items.forEach((item, index) => {
            if (item.components && item.components.length > 0) {
              item.components.forEach((comp, compIndex) => {
              });
            }
          });
        }
      } catch (e) {
      }
    }
  } else {
    console.log('Cart data element not found');
  }
  // Check DOM cart items
  const cartRows = document.querySelectorAll('tr.cart-item');
  cartRows.forEach((row, index) => {
    const title = row.querySelector('.cart-item__name .half-product-titles')?.textContent?.trim();
    const properties = row.querySelector('.properties-wrapper');
    const options = row.querySelectorAll('.product-option');
    
    console.log(`DOM Row ${index}: ${title}`);
    console.log(`  - Properties wrapper:`, properties ? 'Found' : 'Not found');
    console.log(`  - Product options:`, options.length);
    
    options.forEach((option, optIndex) => {
      console.log(`    Option ${optIndex}:`, option.textContent.trim());
    });
  });
}

async getShippingRates() {
    try {
      const response = await fetch('/cart/async_shipping_rates.json');
      const data = await response.json();
      
      if (data && data.shipping_rates && data.shipping_rates.length > 0) {
        // Return the first shipping rate
        const firstRate = data.shipping_rates[0];
        return {
          name: firstRate.name,
          price: parseFloat(firstRate.price),
          presentmentName: firstRate.presentment_name || firstRate.name,
          deliveryRange: firstRate.delivery_range || []
        };
      } else {
        console.warn("No shipping rates found", data);
        return null;
      }
    } catch (error) {
      console.error("Error fetching shipping rates:", error);
      return null;
    }
  }


  async printCart(printType = 'dealer-po') {
    this.debugCartData();
      // Wait for html2pdf to load
      while (!window.html2pdf) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Get cart items from DOM
      const cartItems = this.extractCartItemsData();
      if (!cartItems || cartItems.length === 0) return;
      const shippingRate = await this.getShippingRates();

      // Create the PDF content container
      const container = document.createElement('div');
      container.style.cssText = `
        width: 100%;
        min-height: 100vh;
        padding: 20px;
        margin: 0;
        font-family: "Inter", sans-serif;
        background: white;
      `;

      // Add header
      const headerContainer = this.createPDFHeader(printType);
      container.appendChild(headerContainer);

      // Add product table
      const productTable = this.createProductTable(cartItems, printType);
      container.appendChild(productTable);

      // Add footer with shipping and totals
      const footerContainer = this.createPDFFooter(printType, shippingRate);
      container.appendChild(footerContainer);

      // Create temporary container and add to document with minimal visual impact
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.top = '0';
      tempContainer.style.left = '0';
      tempContainer.style.width = '100%';
      tempContainer.style.height = '100%';
      tempContainer.style.zIndex = '-1';
      tempContainer.style.opacity = '0';
      tempContainer.style.pointerEvents = 'none';
      tempContainer.appendChild(container);
      document.body.appendChild(tempContainer);

      // Configure PDF options
      // Load web fonts
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready; // <- it's a Promise, not a function
      }

      const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 2));

      const filename = printType === 'msrp' ? 'dmf-cart-msrp.pdf' : 'dmf-cart-dealer-po.pdf';
      const opt = {
        margin: [0.2, 0.5, 0.5, 0.5],
        filename: filename,
        image: { type: 'png', quality: 1 }, // PNG avoids JPEG artifacts on text
        html2canvas: {
          scale,              // <- key for sharpness
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollY: 0,
          windowWidth: container.scrollWidth // capture at natural width
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
          compress: false // keep max quality
        }
      };

      try {
        // Show loading state
        const triggerBtn = this.querySelector('.print-trigger-btn') || this.printButton;
        if (triggerBtn) {
          triggerBtn.style.opacity = '0.5';
          triggerBtn.style.pointerEvents = 'none';
          
          // Preserve the existing SVG icon
          const existingSvg = triggerBtn.querySelector('svg');
          const svgHtml = existingSvg ? existingSvg.outerHTML : '';
          
          // Update content while preserving icon
          if (triggerBtn.textContent) {
            triggerBtn.innerHTML = svgHtml + ' Print...';
          }
        }

        // Generate PDF
        await html2pdf().set(opt).from(container).save();
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('There was an error generating the PDF. Please try again.');
      } finally {
        // Clean up temporary container
        document.body.removeChild(tempContainer);
        
        // Reset button state
        const triggerBtn = this.querySelector('.print-trigger-btn') || this.printButton;
        if (triggerBtn) {
          triggerBtn.style.opacity = '1';
          triggerBtn.style.pointerEvents = 'auto';
          
          // Preserve the existing SVG icon when resetting
          const existingSvg = triggerBtn.querySelector('svg');
          const svgHtml = existingSvg ? existingSvg.outerHTML : '';
          
          if (triggerBtn.textContent && triggerBtn.textContent.includes('Print')) {
            triggerBtn.innerHTML = svgHtml + ' Print';
          }
        }
      }
  }

  extractCartItemsData() {
    const items = [];
    const cartRows = document.querySelectorAll('tr.cart-item');
    
    cartRows.forEach((row, index) => {
      // Skip TARIFF items
      const cartItemName = row.querySelector('.cart-item__name .half-product-titles');
      if (!cartItemName) return;
      
      const productTitle = cartItemName.textContent.trim();
      
      // Get image
      const imgElement = row.querySelector('.cart-item__image');
      const imageUrl = imgElement ? imgElement.src : '';
      
      // Get price
      const priceElement = row.querySelector('.product-option .print-hide, .product-option span:not(.printed-price)') || 
                          row.querySelector('.cart-item__final-price') ||
                          row.querySelector('[data-hulkapps-ci-price]');
      let price = '$0.00';
      if (priceElement) {
        price = priceElement.textContent.trim();
      }
      
      // Get quantity
      const quantityElement = row.querySelector('.quantity__input');
      const quantity = quantityElement ? parseInt(quantityElement.value) || 1 : 1;
      
      // Get fixture type
      const fixtureInput = row.querySelector('input.fixture_input');
      const fixtureType = fixtureInput && fixtureInput.value.trim() ? fixtureInput.value.trim() : '';
      
      // Get bundle component details from cart data
      let detailedSpecs = [];
      
      // First try to get from window.cartDataFormatted if available
      if (window.cartDataFormatted && window.cartDataFormatted.cart && window.cartDataFormatted.cart.items) {
        const cartItem = window.cartDataFormatted.cart.items[index];
        if (cartItem && cartItem.components && cartItem.components.length > 0) {
          // This is a bundle with components
          cartItem.components.forEach(component => {
            detailedSpecs.push({
              title: component.title,
              sku: component.sku,
              price: component.price ? `$${component.price.amount}` : '',
              variant_title: component.variant_title
            });
          });
        }
      }
      
      // Fallback: Extract from DOM if cart data not available
      if (detailedSpecs.length === 0) {
        // Get basic product options
        const productOptions = row.querySelectorAll('.product-option');
        let otherDetails = [];
        
        productOptions.forEach(option => {
          const optionText = option.textContent.trim();
          if (optionText && !optionText.includes('$') && optionText !== quantity.toString()) {
            // Parse option details like "Shape: 4-inch Round", "Lumens: 1000 lm", etc.
            if (optionText.includes(':')) {
              otherDetails.push(optionText);
            }
          }
        });
        
        // Get properties from properties wrapper
        const propertiesWrapper = row.querySelector('.properties-wrapper');
        if (propertiesWrapper) {
          const properties = propertiesWrapper.querySelectorAll('.property-item');
          properties.forEach(prop => {
            const propText = prop.textContent.trim();
            if (propText && !propText.toLowerCase().includes('fixture type')) {
              otherDetails.push(propText);
            }
          });
        }
        
        // If we have other details, create a single spec entry
        if (otherDetails.length > 0) {
          detailedSpecs.push({
            title: productTitle,
            sku: this.extractSKUFromRow(row),
            details: otherDetails
          });
        }
      }
      
      // If still no detailed specs, create basic entry
      if (detailedSpecs.length === 0) {
        detailedSpecs.push({
          title: productTitle,
          sku: this.extractSKUFromRow(row),
          details: []
        });
      }
      
      items.push({
        title: productTitle,
        image: imageUrl,
        price: price,
        quantity: quantity,
        fixtureType: fixtureType,
        bundleComponents: detailedSpecs
      });
    });
    
    return items;
  }

  extractSKUFromRow(row) {
    let sku = '';
    
    // Try to get SKU from different sources
    const skuElements = row.querySelectorAll('[data-variant-id], dt, .product-option');
    skuElements.forEach(el => {
      const text = el.textContent;
      if (text.includes('SKU:')) {
        sku = text.replace('SKU:', '').trim();
      } else if (text.match(/[A-Z]{2,}[\d\-]+/)) {
        // Match pattern like ART4D-07T27NST, M4TRPWH, etc.
        const matches = text.match(/[A-Z]{2,}[\d\-]+/g);
        if (matches && matches.length > 0) {
          sku = matches[0];
        }
      }
    });
    
    return sku;
  }

  createProductTable(items, printType) {
    const table = document.createElement('div');
    table.style.cssText = `
      margin: 30px 0;
      width: 100%;
      padding: 0px 30px;
    `;
    
    // Create table header
    const headerRow = document.createElement('div');
    headerRow.style.cssText = `
      display: flex;
      margin-bottom: 10px;
      font-weight: bold;
      font-size: 12px;
      color: #000000;
      justify-content: center;
    `;
    
    headerRow.innerHTML = `
      <div style="text-align: center; border: none; padding: 10px 5px 0px; font-weight: 800; font-size: 12px; line-height: 12px; width: 40%;"><span style="border-bottom: 1px solid #000000;">Product</span></div>
      <div style="text-align: center; border: none; padding: 10px 5px 0px; font-weight: 800; font-size: 12px; line-height: 12px; width: 30%;"><span style="border-bottom: 1px solid #000000;">Unit Price</span></div>
      <div style="text-align: center; border: none; padding: 10px 5px 0px; font-weight: 800; font-size: 12px; line-height: 12px; width: 15%;"><span style="border-bottom: 1px solid #000000;">Qty</span></div>
      <div style="text-align: right; border: none; padding: 10px 5px 0px; font-weight: 800; font-size: 12px; line-height: 12px; width: 15%;"><span style="border-bottom: 1px solid #000000;">Price</span></div>
    `;
    
    table.appendChild(headerRow);
    
    // Create product rows
    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: flex-start;
        padding: 10px 0;
        page-break-inside: avoid;
        color: #000000;
      `;
      
      // Calculate prices
      const unitPriceNum = parseFloat(item.price.replace(/[$,]/g, ''));
      const finalUnitPrice = printType === 'msrp' ? (unitPriceNum * 2) : unitPriceNum;
      const totalPrice = finalUnitPrice * item.quantity;
      
      // Build detailed component information
      let componentDetails = '';

if (item.bundleComponents && item.bundleComponents.length > 0) {
  item.bundleComponents.forEach((component, componentIndex) => {
    if (component.sku || component.title !== item.title) {
      componentDetails += `<div style="margin: 2px 0; padding: 2px 0; border-top: ${componentIndex > 0 ? '1px solid #eee' : 'none'};">`;
      
      // Component title (if different from main title)
      if (component.title && component.title !== item.title) {
        componentDetails += `<span style="font-weight: bold; font-size: 9px;">${component.title}</span><br>`;
      }
      
      // Component SKU - remove price information
      if (component.sku) {
        let cleanSku = component.sku.replace(/\s*-\s*\$[\d,]+\.?\d*\s*(USD)?\s*(\$[\d,]+\.?\d*)?\s*$/g, '');
        cleanSku = cleanSku.replace(/\s*\$[\d,]+\.?\d*\s*(USD)?\s*$/g, '');
        cleanSku = cleanSku.replace(/\s*\$[\d,]+\.?\d*\s*$/g, '');
        componentDetails += `<span style="font-weight: bold;">SKU:</span> ${cleanSku}<br>`;
      }
      
      // Component variant/details
      if (component.variant_title) {
        componentDetails += `<span style="font-weight: bold;">Type:</span> ${component.variant_title}<br>`;
      }
      
      // Additional details - remove price information AND format labels
      if (component.details && component.details.length > 0) {
        component.details.forEach(detail => {
          let cleanDetail = detail.replace(/\s*-\s*\$[\d,]+\.?\d*\s*(USD)?\s*(\$[\d,]+\.?\d*)?\s*$/g, '');
          cleanDetail = cleanDetail.replace(/\s*\$[\d,]+\.?\d*\s*(USD)?\s*$/g, '');
          cleanDetail = cleanDetail.replace(/\s*\$[\d,]+\.?\d*\s*$/g, '');
          if (cleanDetail.trim()) {
            // Check if the detail has a colon separator (like "Module Type: Downlight")
            if (cleanDetail.includes(':')) {
              const parts = cleanDetail.split(':');
              const label = parts[0].trim();
              const value = parts.slice(1).join(':').trim(); // Handle case where value might contain colons
              componentDetails += `<span style="font-weight: bold;">${label}:</span> ${value}<br>`;
            } else {
              // Check if this contains a SKU pattern like (x1) X2TRDSBKMF - $47.30 USD
              console.log('Processing detail without colon:', JSON.stringify(cleanDetail));
              if (cleanDetail.includes('(x') && cleanDetail.includes('-')) {
                console.log('Found (x pattern with dash, trying to extract SKU...');
                const skuMatch = cleanDetail.match(/\(x\d+\)\s*([A-Z0-9\-]+)/);
                const priceMatch = cleanDetail.match(/(\$[\d,]+\.?\d*\s*USD?)/);
                console.log('SKU match result:', skuMatch);
                console.log('Price match result:', priceMatch);
                if (skuMatch) {
                  const sku = skuMatch[1]; // Get the SKU part (group 1)
                  const price = priceMatch ? priceMatch[1] : ''; // Get the price if found
                  console.log('SUCCESS: Extracted SKU:', sku, 'Price:', price);
                  if (price) {
                    componentDetails += `<span style="font-weight: bold;">SKU: ${sku} - ${price}</span><br>`;
                  } else {
                    componentDetails += `<span style="font-weight: bold;">SKU: ${sku}</span><br>`;
                  }
                } else {
                  console.log('FAILED: Could not extract SKU, adding as regular text');
                  componentDetails += `${cleanDetail}<br>`;
                }
              } else {
                console.log('No (x pattern with dash found, adding as regular text');
                // If no SKU pattern, just add the detail as is
                componentDetails += `${cleanDetail}<br>`;
              }
            }
          }
        });
      }
      
      componentDetails += `</div>`;
    } else if (component.details && component.details.length > 0) {
      // If no separate component, show the details directly - remove price information AND format labels
      component.details.forEach(detail => {
        let cleanDetail = detail.replace(/\s*-\s*\$[\d,]+\.?\d*\s*(USD)?\s*(\$[\d,]+\.?\d*)?\s*$/g, '');
        cleanDetail = cleanDetail.replace(/\s*\$[\d,]+\.?\d*\s*(USD)?\s*$/g, '');
        cleanDetail = cleanDetail.replace(/\s*\$[\d,]+\.?\d*\s*$/g, '');
        if (cleanDetail.trim()) {
          // Check if the detail has a colon separator (like "Module Type: Downlight")
          if (cleanDetail.includes(':')) {
            const parts = cleanDetail.split(':');
            const label = parts[0].trim();
            const value = parts.slice(1).join(':').trim(); // Handle case where value might contain colons
            componentDetails += `<span style="font-weight: bold;">${label}:</span> ${value}<br>`;
          } else {
            // Check if this contains a SKU pattern like (x1) X2TRDSBKMF - $47.30 USD
            console.log('Section 2 - Processing detail without colon:', JSON.stringify(cleanDetail));
            if (cleanDetail.includes('(x') && cleanDetail.includes('-')) {
              console.log('Section 2 - Found (x pattern with dash, trying to extract SKU...');
              const skuMatch = cleanDetail.match(/\(x\d+\)\s*([A-Z0-9\-]+)/);
              const priceMatch = cleanDetail.match(/(\$[\d,]+\.?\d*\s*USD?)/);
              console.log('Section 2 - SKU match result:', skuMatch);
              console.log('Section 2 - Price match result:', priceMatch);
              if (skuMatch) {
                const sku = skuMatch[1]; // Get the SKU part (group 1)
                const price = priceMatch ? priceMatch[1] : ''; // Get the price if found
                console.log('Section 2 - SUCCESS: Extracted SKU:', sku, 'Price:', price);
                if (price) {
                  componentDetails += `<span style="font-weight: bold;">SKU: ${sku} - ${price}</span><br>`;
                } else {
                  componentDetails += `<span style="font-weight: bold;">SKU: ${sku}</span><br>`;
                }
              } else {
                console.log('Section 2 - FAILED: Could not extract SKU, adding as regular text');
                componentDetails += `${cleanDetail}<br>`;
              }
            } else {
              console.log('Section 2 - No (x pattern with dash found, adding as regular text');
              // If no SKU pattern, just add the detail as is
              componentDetails += `${cleanDetail}<br>`;
            }
          }
        }
      });
    }
  });
}
      
      // Add fixture type if available
      if (item.fixtureType) {
        componentDetails += `<strong>Fixture Type:</strong> ${item.fixtureType}<br>`;
      }
      
      row.innerHTML = `
        <div style="padding: 10px 0px; vertical-align: top; width: 40%; border: none;">
          <div style="display: flex;">
            <img src="${item.image}" alt="${item.title}" style="width: 34px; height: 46px; margin-right: 15px; object-fit: cover; border-radius: 2px;">
            <div style="width: calc(100% - 49px);">
              <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px; line-height: 1.2;">
                ${item.title}
              </div>
              <div style="font-size: 10px; color: #000000; line-height: 14px; margin-left: 12px;">
                ${componentDetails}
              </div>
            </div>
          </div>
        </div>
        <div style="padding: 10px 5px; text-align: center; font-weight: normal; border: none; font-size: 12px; width: 30%;">
          ${this.formatPrice(finalUnitPrice)}
        </div>
        <div style="padding: 10px 5px; text-align: center; font-size: 12px; border: none; width: 15%;">
          ${item.quantity}
        </div>
        <div style="padding: 10px 5px; text-align: right; font-weight: bold; border: none; font-size: 12px; width: 15%;">
          ${this.formatPrice(totalPrice)}
        </div>
      `;
      
      table.appendChild(row);
    });
    
    return table;
  }
  

  createPDFHeader(printType) {
    const title = printType === 'msrp' ? 'Quick Quote' : 'Confidential Pricing';
    const date = new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });

    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 5px;
      align-items: flex-start;
    `;
    
    headerContainer.innerHTML = `
      <div style="width: 33.33%">&nbsp;</div>
      <div style="width: 33.33%; text-align: center;">
        <svg width="90" height="35" viewBox="0 0 90 35" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.4789 11.8786H17.3842C15.7263 9.65432 13.4053 8.51852 10.3737 8.51852C3.41053 8.51852 0 14.5761 0 20.965C0 27.8745 3.26842 34.5 10.9895 34.5C13.8316 34.5 16.2 33.2695 17.7632 30.9506H17.8579V33.7901H25.5316V0H17.4789V11.8786ZM12.9789 28.3477C9.28421 28.3477 8.05263 24.609 8.05263 21.249C8.05263 18.1255 9.28421 14.6708 12.9789 14.6708C16.4842 14.6708 17.7632 17.9362 17.7632 21.4856C17.7632 24.609 16.9105 28.3477 12.9789 28.3477Z" fill="#141414"/>
          <path d="M60.4895 8.51852C57.1737 8.51852 54.7579 9.89094 52.8158 12.4938C51.4895 9.51234 48.7421 8.51852 45.6632 8.51852C42.5842 8.51852 40.0737 10.1276 38.6053 12.5885H38.5105V9.22839H30.6947V33.7901H38.7474V21.8169C38.7474 16.8004 39.9789 15.144 42.8684 15.144C45.0474 15.144 45.9 16.9424 45.9 19.8292V33.7901H53.9526V21.7695C53.9526 17.7942 54.2842 15.144 57.7421 15.144C59.8263 15.144 61.1053 16.7058 61.1053 19.356V33.7901H69.1579V19.1193C69.1579 14.4342 68.3053 8.51852 60.4895 8.51852Z" fill="#141414"/>
          <path d="M87.8211 5.67901C88.5316 5.67901 89.2421 5.72634 90 5.82099V0.141975C88.7211 0.0946502 87.3947 0 86.1158 0C79.2474 0 76.7842 2.17695 76.7842 9.22839H72.9V14.4342H76.7842V33.7901H84.8368V14.4342H89.6684V9.22839H84.8368V8.13992C84.8368 5.91564 85.9737 5.67901 87.8211 5.67901Z" fill="#141414"/>
        </svg>

        <h1 style="margin: 0 0 5px 0; font-size: 20px; font-weight: bold;">${title}</h1>
      </div>
      <div style="text-align: right; width: 33.33%">
        <p style="margin: 0; font-size: 12px; font-weight: bold; color: #000000; text-align: right;">Date: ${date}</p>
      </div>
    `;

    return headerContainer;
  }

  createPDFFooter(printType, shippingRate) {
    // Calculate subtotal - improved logic
    let formattedTotal = 0;
    
    // First try to get from shipping rate data if available
    if (window.shippingData && window.shippingData.cart_total) {
      formattedTotal = parseFloat(window.shippingData.cart_total) || 0;
    } else {
      // Fallback to DOM elements
      const cartTotalElement = document.querySelector('[data-hulkapps-cart-total], .totals__total-value, [subtotal-value]');
      const cartTotalText = cartTotalElement ? cartTotalElement.textContent.trim() : '$0.00';
      const cartTotal = cartTotalText.replace(/[$,\s]/g, '');
      formattedTotal = parseFloat(cartTotal) || 0;
    }
    
    // Apply MSRP pricing if needed
    const displayTotalNum = printType === 'msrp' ? (formattedTotal * 2) : formattedTotal;
    const displayTotal = this.formatPrice(displayTotalNum);
    
    // Get shipping information
    let shippingAddress = 'Your Company Name<br>1234 W Main Street<br>Anytown, USA 55512';
    let shippingCost = 'Calculated at Checkout';
    let totalDisplay = 'Calculated at Checkout';

    // Use shipping data from API response
    if (window.shippingData && window.shippingData.success) {
      // Get company information
      if (window.shippingData.company_name && window.shippingData.company_address) {
        const company = window.shippingData.company_name;
        const addr = window.shippingData.company_address;
        
        shippingAddress = `
          ${company}<br>
          ${addr.address1 ? `${addr.address1}<br>` : ''}
          ${addr.address2 ? `${addr.address2}<br>` : ''}
          ${addr.city && addr.provinceCode && addr.zip ? 
            `${addr.city}, ${addr.provinceCode} ${addr.zip}` : ''}
        `;
      }
      
      // Get shipping cost from shipping_rates
      if (window.shippingData.shipping_rates && window.shippingData.shipping_rates.length > 0) {
        const firstRate = window.shippingData.shipping_rates[0];
        const shippingCostValue = firstRate.total_charge || 0;
        
        if (shippingCostValue === 0 || window.shippingData.free_shipping_applied) {
          shippingCost = 'FREE';
          totalDisplay = displayTotal;
        } else {
          shippingCost = this.formatPrice(shippingCostValue);
          totalDisplay = this.formatPrice(displayTotalNum + shippingCostValue);
        }
      }
    } else if (shippingRate) {
      // Fallback to passed shippingRate parameter
      if (shippingRate.price === 0) {
        shippingCost = 'FREE';
        totalDisplay = `${displayTotal}`;
      } else {
        shippingCost = this.formatPrice(shippingRate.price);
        totalDisplay = this.formatPrice(displayTotalNum + shippingRate.price);
      }
    }

    const footerContainer = document.createElement('div');
    footerContainer.style.cssText = `
      margin-top: 20px;
      padding: 20px 20px 0px 20px;
      border-top: 2px solid #000000;
      display: flex;
      color: #000000;
      justify-content: space-between;
      align-items: flex-start;
      font-family: "Inter", sans-serif;
      page-break-inside: avoid;
    `;
    
    footerContainer.innerHTML = `
      <div style="width: 100%; margin-right: 20px;">
        <h3 style="font-size: 12px; font-weight: bold; margin: 0 0 7px 0; color: #000000;">Shipping Address</h3>
        <div style="color: #000000; line-height: 12px; font-size: 10px;">
          ${shippingAddress}
        </div>
        <p style="font-size: 8px; color: #000000; margin: 9px 0 0 0; line-height: 10px; max-width: 204px; font-style: italic;">
          <strong>Note:</strong> This address is used to calculate the shipping costs. If a different address is required please contact your sales support team member for a custom quote.
        </p>
      </div>

      <div style="flex: 0 0 300px; text-align: right;">
        <div style="padding: 0px 16px;">
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px;">
            <span style="color: #000000; font-weight: bold;">SubTotal</span>
            <span style="font-weight: bold; color: #000000;">${displayTotal}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px;">
            <span style="color: #000000; font-weight: bold;">Expected Shipping</span>
            <span style="color: #000000; font-style: italic; font-size: 10px;">${shippingCost}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold;">
            <span style="color: #000000; font-weight: bold;">Total</span>
            <span style="color: #000000; font-style: italic; font-size: 10px;">${totalDisplay}</span>
          </div>
          
        </div>
      </div>
    `;

    return footerContainer;
  }
}

customElements.define('print-cart-button', PrintCartButon);

class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      
      // First check what will remain after removing this item
      this.checkBeforeRemove();
    });
  }

  checkBeforeRemove() {
    const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
    const removeIndex = parseInt(this.dataset.index);
    
    fetch('/cart.json')
      .then(response => response.json())
      .then(cart => {
        // Simulate removal - what items will remain?
        const remainingItems = cart.items.filter((item, index) => {
          return (index + 1) !== removeIndex; // Cart indices are 1-based
        });
        
        // Check if only TARIFF items will remain
        const onlyTariffWillRemain = remainingItems.length > 0 && 
                                    remainingItems.every(item => item.sku === 'TARIFF');
        
        if (onlyTariffWillRemain) {
          // Clear entire cart instead of removing individual item
          fetch('/cart/clear.js', { method: 'POST' })
            .then(() => window.location.reload());
        } else {
          // Normal removal
          cartItems.updateQuantity(removeIndex, 0);
        }
      })
      .catch(() => {
        // Fallback to normal removal if prediction fails
        const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
        cartItems.updateQuantity(removeIndex, 0);
      });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  ignoreValidation(event){
    // somefields in the page does not require quantity validation
    const ignoreFieldsAttribute = ['edit-fixture-field']
    let ignoreValidation = false;

    for (let i = 0; i < ignoreFieldsAttribute.length; i++) {
      const attribute = ignoreFieldsAttribute[i];

      if(event.target.hasAttribute(attribute)){
        ignoreValidation = true;
        break;
      }
      
    }
    return ignoreValidation;
  }

  onChange(event) {
    const ignoreValidation = this.ignoreValidation(event)

    if(!ignoreValidation){
      this.validateQuantity(event);
    }
    
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      
      fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer')?.dataset?.id,
        selector: '.js-contents',
      },
    ];
  }

  updateSubtotalPrice(subtotalPrice){
    const subtotal = document.querySelectorAll('[subtotal-value]');
    if(subtotal.length){
      for (let i = 0; i < subtotal.length; i++) {
        const subtotalElement = subtotal[i];
        const money = window.Shopify.formatMoney(subtotalPrice)
        subtotalElement.textContent = money;
      }
    }
  }

  updateQuantity(line, quantity, name, variantId) {
    this.enableLoading(line);
    
    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        this.updateSubtotalPrice(parsedState.items_subtotal_price / 100)
        const quantityElement =
          document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
        const items = document.querySelectorAll('.cart-item');

        if (parsedState.errors) {
          quantityElement.value = quantityElement.getAttribute('value');
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');

        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document.getElementById(section.id)?.querySelector(section.selector) || document.getElementById(section.id);
            if(elementToReplace){
              elementToReplace.innerHTML = this.getSectionInnerHTML(
                parsedState.sections[section.section],
                section.selector
              );
            }
        });
        const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
        let message = '';
        if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
          if (typeof updatedValue === 'undefined') {
            message = window.cartStrings.error;
          } else {
            message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
          }
        }
        this.updateLiveRegions(line, message);
        

        const lineItem =
          document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          cartDrawerWrapper
            ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
            : lineItem.querySelector(`[name="${name}"]`).focus();
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
        } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
        }
        
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch((err) => {
        console.error('inside updateQuantity', err)
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').innerHTML = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html')?.querySelector(selector)?.innerHTML;
  }

  enableLoading(line) {
    
    document.querySelector('form.cart__contents')?.classList.add('loading-element')

    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    
    document.querySelector('form.cart__contents')?.classList.remove('loading-element')

    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}