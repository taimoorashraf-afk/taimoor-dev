/* this class mainly contains cart featrues related to product customization or bundle features */
/* and its included in theme.liquid file */

class Cart{
    constructor(){
        this.cart = {}
        this.fetchCart()
    }

    async fetchCart(){
        let cartResp = await fetch('/cart.json')
        cartResp = await cartResp.json()
        this.cart = cartResp
    }

    async changeCartApi(updates){
      let resp = await fetch(window.Shopify.routes.root + 'cart/update.js', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ updates })
      })
      resp = await resp.json()
      // console.log('cart updated ', resp)
      return resp
    }

    

    getItemsPayload(){
        const allQuantityInput = document.querySelectorAll('.js-qty__num')
        const cartItems = {}
        
        for (let i = 0; i < allQuantityInput.length; i++) {
            const input = allQuantityInput[i];
            const bundleId = input?.getAttribute('bundleId')
            const key = input.getAttribute('data-id') 
            cartItems[key] = input.value
        }
        
        return cartItems;
    }
  
    generateId(items){
      // const eachSkuExists = items.every(item => item.defaultVariant.sku)
      // if(eachSkuExists){
      //   let bundleId = items.map(item => item.defaultVariant.sku).join('_')
      //   // const fixtureValue = document.querySelector('[name="properties[Fixture Type]"]').value
      //   // if(fixtureValue) {
      //   //   bundleId += `__${fixtureValue}` 
      //   // }
      //   return bundleId +  `__${Date.now().toString()}`
      // }
      // else {
        return Date.now().toString();
      // }
    }

    async fetchImageCDNbasedUrl(){
      // shopify cart transform function does not accept other the CDN urls for image for bundle structure 
      const targetImage = document.querySelector('.product__media-item:not(.hidden) img')
      const imageAltText = targetImage?.alt
      const parentProductHandle = targetImage?.product_handle
      
      if(!imageAltText) return ''

      let productUrl = parentProduct.url
      if(parentProductHandle){
        productUrl = `/products/${parentProductHandle}`
      }
      
      let productData = await fetch(productUrl + ".json")
      productData = await productData.json()
      
      const imageUrl = productData?.product?.images?.find(item => item.alt == imageAltText)?.src
      return imageUrl
    }

    fetchPropertiesFromForm(){
      const propertiesObject = {}
      const propertiesFields = document.querySelectorAll('input[name*="properties"]')

      for (let i = 0; i < propertiesFields.length; i++) {
        const item = propertiesFields[i];
        const key = item.getAttribute('name').match(/\[(.*?)\]/)[1]
        const value = item.value
        propertiesObject[key] = value;
      }

      return propertiesObject;
    }
  
    async addToCartV2(items){
      // add to cart for bundle products / customizable products
      addToCartButton.loading(true)
      const bundleId = this.generateId(items)
      const quantity = document.querySelector('.pc-quantity-selector input[name="quantity"]')?.value
      const imageUrl = await this.fetchImageCDNbasedUrl()
      const parentProductData = {
        title : parentProduct.title,
        url : parentProduct.url,
        defaultVariantId: `gid://shopify/ProductVariant/${parentProduct.variants[0].id}`,
        imageUrl: imageUrl,
        productDeepLink: window.location.href.split('?')[1]
      }

      const properties = this.fetchPropertiesFromForm() 

      const itemsToAddCart = items.map(item => {
        return {
          properties: {
            "_bundleId" : bundleId,
            "SKU" : item.sku,
            "_parentProduct" : parentProductData,
            // "_className" : item.class,
            // "_metadata" : item.metadata,
            "_View Image" : imageUrl,
            ...properties
          },
          id: item.defaultVariantId.split('/').pop(),
          quantity: parseInt(quantity),
        }
      })
      
      let formData = {
        'items': itemsToAddCart
      };
       
      //cartPopupNotification is defined in cart-notification.js
      if(cartPopupNotification){
        formData = cartPopupNotification.getCartNotificationSections(formData)
      }
      
      let cartResp = await fetch(window.Shopify.routes.root + 'cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      
      cartResp = await cartResp.json()
      
      if(cartPopupNotification){
          cartPopupNotification.updateCartNotification(cartResp)
      }
      
    //   ShopifyAPI.showCartNotificationForBundleProducts(bundleId) //defination available in theme.js.liquid
      addToCartButton.loading(false)
      // console.log('addToCart resp', cartResp)
    }

  }
  const cart = new Cart()