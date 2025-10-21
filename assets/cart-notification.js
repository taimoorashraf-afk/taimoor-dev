class CartNotification extends HTMLElement {
  constructor() {
    super();

    this.notification = document.getElementById('cart-notification');
    this.header = document.querySelector('sticky-header');
    this.onBodyClick = this.handleBodyClick.bind(this);

    this.notification.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelectorAll('button[type="button"]').forEach((closeButton) =>
      closeButton.addEventListener('click', this.close.bind(this))
    );
  }

  open() {
    this.notification.classList.add('animate', 'active');
    this.notification.parentElement.classList.add('activeParent');
    this.notification.addEventListener(
      'transitionend',
      () => {
        this.notification.focus();
        trapFocus(this.notification);
      },
      { once: true }
    );

    document.body.addEventListener('click', this.onBodyClick);
  }

  close() {
    this.notification.classList.remove('active');
    this.notification.parentElement.classList.remove('activeParent');
    document.body.removeEventListener('click', this.onBodyClick);

    removeTrapFocus(this.activeElement);
  }

  renderContents(parsedState) {
    // debugger
    this.cartItemKey = parsedState.key;
    this.getSectionsToRender().forEach((section) => {
      if(document.getElementById(section.id)){
        document.getElementById(section.id).innerHTML = this.getSectionInnerHTML(
          parsedState.sections[section.id],
          section.selector
        );
      }
    });

    if (this.header) this.header.reveal();
    this.open();
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-notification-product',
        selector: `[id="cart-notification-product-${this.cartItemKey}"]`,
      },
      {
        id: 'cart-notification-button',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector)?.innerHTML;
  }

  handleBodyClick(evt) {
    const target = evt.target;
    if (target !== this.notification && !target.closest('cart-notification')) {
      const disclosure = target.closest('details-disclosure, header-menu');
      this.activeElement = disclosure ? disclosure.querySelector('summary') : null;
      this.close();
    }
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-notification', CartNotification);

class CartNotificationWrapper{
  // this class uses CartNotification class from cart-Notification.js

  constructor(){
      this.cartNotification = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
  }

  getCartNotificationSections(formData){
    if (this.cartNotification) {
      formData['sections'] = this.cartNotification.getSectionsToRender().map((section) => section.id)
      formData['sections_url'] =  window.location.pathname
      this.cartNotification.setActiveElement(document.activeElement);
    }

    return formData
  }

  updateCartNotification(cartResp){
    if (this.cartNotification) {
      if(cartResp.items.length){
        cartResp.items[0]['sections'] = cartResp.sections
        this.cartNotification.renderContents(cartResp.items[0]);
      }
    }
  }
}
const cartPopupNotification = new CartNotificationWrapper();
