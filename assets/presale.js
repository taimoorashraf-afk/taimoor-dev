/* Presale (STOQ) integration - reusable class component
 * Usage:
 * 1) Include this asset in theme.liquid or the specific template:
 *    <script src="{{ 'presale.js' | asset_url }}" defer="defer"></script>
 * 2) Drop the HTML anywhere (see snippets/presale.liquid) or add an element with:
 *    <div data-presale data-product-id="..." data-variant-id="..."></div>
 */

(function() {
  'use strict';

  class Presale {
    constructor(container) {
      this.container = container;
      this.button = null;
      this.productId = null;
      this.variantId = null;
      this.setupComplete = false;
      this.stoqCheckInterval = null;

      this.init();
    }

    init() {
      if (!this.container) return;

      // Read IDs from dataset or from button attributes
      this.productId = this.container.getAttribute('data-product-id') || this.container.dataset.productId;
      this.variantId = this.container.getAttribute('data-variant-id') || this.container.dataset.variantId;

      // Ensure button exists (rendered markup provides it). If not, create one.
      this.button = this.container.querySelector('[data-presale-button]');
      if (!this.button) {
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.setAttribute('data-presale-button', '');
        this.button.className = 'button';
        this.button.textContent = 'Notify Me When Available';
        if (this.productId) this.button.setAttribute('data-product-id', this.productId);
        if (this.variantId) this.button.setAttribute('data-variant-id', this.variantId);
        this.container.appendChild(this.button);
      }

      // Hide button until fully initialized and STOQ is ready
      if (this.button) {
        this.button.style.display = 'none';
        this.button.style.backgroundColor = '#292521';
        this.button.setAttribute('aria-hidden', 'true');
      }

      // Start STOQ availability handling
      this.startStoqPolling();
      // Also attempt immediate setup
      this.checkStoqAndSetup();

      // Failsafe to try setup again after 20s
      setTimeout(() => this.setupNotifyMeButton(), 20000);
    }

    startStoqPolling() {
      if (this.stoqCheckInterval) clearInterval(this.stoqCheckInterval);
      this.stoqCheckInterval = setInterval(() => this.checkStoqAndSetup(), 500);

      // Stop polling after 10 seconds
      setTimeout(() => {
        if (this.stoqCheckInterval) { 
          clearInterval(this.stoqCheckInterval);
          this.stoqCheckInterval = null;
        }
      }, 10000);
    }

    checkStoqAndSetup() {
      if (window._RestockRocket && !this.setupComplete) {
        this.setupComplete = true;
        if (this.stoqCheckInterval) {
          clearInterval(this.stoqCheckInterval);
          this.stoqCheckInterval = null;
        }
        this.setupNotifyMeButton();
      }
    }

    setupNotifyMeButton() {
      if (!this.button || !window._RestockRocket) return;

      // Avoid duplicate listeners
      if (this.button.__presaleBound) return;
      this.button.__presaleBound = true;

      // Reveal the button now that it is ready
      this.button.style.display = '';
      this.button.removeAttribute('aria-hidden');
      this.button.hidden = false;

      this.button.addEventListener('click', () => {
        try {
          const productIdAttr = this.button.getAttribute('data-product-id') || this.productId;
          const variantIdAttr = this.button.getAttribute('data-variant-id') || this.variantId;

          if (!productIdAttr || !variantIdAttr) return;

          // Try to enrich data from nearby DOM where available
          const root = this.container.closest('.list-view-item') || document;
          const productTitle = (root.querySelector('.prod-title') || {}).textContent || '';
          const productType = (root.querySelector('.prod-type') || {}).textContent || '';
          const productImage = (root.querySelector('.prod-img img') || {}).src || '';

          const productData = {
            id: parseInt(productIdAttr, 10),
            title: productTitle,
            type: productType,
            featured_image: productImage,
            variants: [{ id: parseInt(variantIdAttr, 10), available: false }]
          };

          window._RestockRocket.openModal(productData, variantIdAttr);
        } catch (err) {
          // swallow
        }
      });
    }
  }

  function autoInit() {
    document.querySelectorAll('[data-presale]').forEach((el) => {
      if (!el.__presaleInstance) {
        el.__presaleInstance = new Presale(el);
      }
    });
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
  // Set up polling for window._RestockRocket and trigger autoInit when available
  (function pollForRestockRocket() {
    const interval = setInterval(() => {
      if (typeof window._RestockRocket !== 'undefined') {
        clearInterval(interval);
        autoInit();
      }
    }, 100);
    // Optionally, stop polling after a timeout (e.g., 10s) to avoid infinite polling
    setTimeout(() => clearInterval(interval), 10000);
  })();

  // Optional: initialize when a custom event indicates STOQ loaded
  window.addEventListener('stoq:loaded', autoInit);

  // Expose for manual use
  window.Presale = Presale;
})(); 


