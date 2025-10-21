class SalesToolForm extends HTMLElement{
    constructor(){
        super();
        this.form = this.querySelector('form');
        this.message = this.querySelector('.message');
        this.submitButton = this.form.querySelector('button.add_to_cart span');
        this.preorder = this.hasAttribute('data-preorder');
        this.ctaText = 'Add to Cart'
        if(this.preorder){
            this.ctaText = 'Preorder'
        }
    }

    connectedCallback() {
        this.form.addEventListener('submit', this.submitForm.bind(this));   
    }

    async submitForm(event){
        event.preventDefault();
        const variantId = this.form?.querySelector('.variant_id').value;
        const quantity = this.form?.querySelector('.quantity-input').value;   
        
        // Capture all form properties
        const properties = this.getFormProperties();
        
        const viewmore_modal = document.getElementById('myModal');
        const main_body = document.getElementById('main-page-body');
        main_body.style.overflowY = "auto";
        viewmore_modal.style.display = "none";

        this.loading(true);
        const resp = await this.addToCart(variantId, quantity, properties);
        this.loading(false);
        
        if(resp.ok){
            this.showSuccessMessage(resp)
        }
        else {
            this.showErrorMessage(resp.message)
        }
    };

    // New method to capture form properties
    getFormProperties(){
        const properties = {};
        const formData = new FormData(this.form);
        
        // Get all properties from form
        for (let [key, value] of formData.entries()) {
            if (key.startsWith('properties[')) {
                // Extract property name: properties[PRODUCT SKU] -> PRODUCT SKU
                const propertyName = key.match(/properties\[(.*?)\]/)[1];
                properties[propertyName] = value;
            }
        }
        
        console.log('Captured properties:', properties);
        return properties;
    }

    loading(loading){
        if(loading){
            this.submitButton.innerHTML = 'Loading...';
        }
        else {
            this.submitButton.innerHTML = this.ctaText;
        }
    }

    // Updated addToCart method with properties parameter
    async addToCart(variantId, quantity, properties = {}){
        
        if(this.preorder == 'true' || this.preorder == true){
            if(!window._RestockRocket){
                return preorderfailedResponse;
            }
            
            const preorderfailedResponse = {
                ok: false,
                message: 'Preorder not working. Please try again.'
            }

            
            const sellingPlanId = window._RestockRocket.getSellingPlan(parseInt(variantId))?.shopify_selling_plan_id;
            if(!sellingPlanId){
                return preorderfailedResponse;
            }
            properties._stoq_shopify_selling_plan_id = sellingPlanId;
            properties._stoq_preorder_source = "B2B";
            properties["Purchase Type"] = "Preorder";
        }

        let formData = {
            'items': [
                {
                    id: variantId, 
                    quantity: quantity,
                    properties: properties  // Add properties here!
                }
            ]
        };
        
        console.log('Sending to cart:', formData);
        
        if(cartPopupNotification){
            formData = cartPopupNotification.getCartNotificationSections(formData)
        }
        
        try {
            const response = await fetch('/cart/add.js', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(formData),
            });
            
            if (response.ok) {
                let cartData = await response.json();
                cartData.ok = true
                return cartData;
            } else {
                let errorMessage = await response.json();
                errorMessage.ok = false
                return errorMessage;
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
        }
    }

    showSuccessMessage(cartResp){
        if(cartPopupNotification){
            cartPopupNotification.updateCartNotification(cartResp)
        }
        else {
            this.message.innerHTML = 'Item added to cart';
            this.message.classList.add('success');
            this.removeMessage();
        }
    }

    showErrorMessage(errorMessage){
        this.message.innerHTML = `Failed to add item to cart. ${errorMessage}`;
        this.message.classList.add('error');
        this.removeMessage();
    }

    removeMessage(){
        setTimeout(() => {
            this.message.innerHTML = '';
            this.message.classList.remove('success');
            this.message.classList.remove('error');
        }, 4000);
    }
}

customElements.define('sales-tools-form', SalesToolForm);