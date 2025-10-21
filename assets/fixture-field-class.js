class FixtureTypeField extends HTMLElement{
    constructor(){
        super();
        
        this.editFixtureButton = this.querySelectorAll('[edit-fixture-button]');
        this.editFixtureInputField = this.querySelectorAll('[edit-fixture-field]');
        this.cancelButtons = this.querySelectorAll('[cancel-edit-fixture-button]');
        this.saveButtons = this.querySelectorAll('[save-fixture-button]');
        this.attachEventListener();
        this.cart = {}
        this.fetchCart()
      
    }

    // Lifecycle callback: Runs when the element is added to the DOM
    // connectedCallback() {
    //     // this.attachEventListener()
    // }

      // Lifecycle callback: Runs when the element is removed from the DOM
    // disconnectedCallback() {
    //     console.log('Custom element removed from the DOM!');
    // }

    async fetchCart(){
        let resp = await fetch('/cart.js');
        resp = await resp.json()
        this.cart = resp
    }
  
    attachEventListener(){
        if(this.editFixtureButton){
            this.editFixtureButton.forEach(button => {
                button.addEventListener('click', (e) => {this.toggleEditFixtureButton(e.target)})
            })
            this.cancelButtons.forEach(cancelButton => {
                cancelButton.addEventListener('click', (e) => {
                    this.handleCancelButton(e)
                })
            })
            this.saveButtons.forEach(saveButton => {
                saveButton.addEventListener('click', (e) => { 
                    this.handleSaveButton(e.target)
                })
            })
            this.editFixtureInputField.forEach(field => {
                field.addEventListener('keyup', (e) => { 
                    this.validateFixtureInput(e)
                })
            })
            
        }
    }

    // validateFixtureInput(e){
        
    //     const field = e.target;
    //     const saveButton = field.closest('.fixture-type')?.querySelector('[save-fixture-button]');
    //     const value = field.value.trim();
    //     const regex = /^[a-zA-Z0-9\s]*$/;
    //     const ifValid = regex.test(value)
        
    //     if(!ifValid){
    //         field?.setCustomValidity('Only alpha numeric inputs allowed');
    //         field?.reportValidity()
    //         saveButton?.setAttribute('disabled', true)
    //     }
    //     else {
    //         field?.setCustomValidity('');
    //         saveButton?.removeAttribute('disabled')
    //     }

    // }


    validateFixtureInput(e) {
        const field = e.target;
        const saveButton = field.closest('.fixture-type')?.querySelector('[save-fixture-button]');
        const value = field.value.trim();
        const regex = /^[a-zA-Z0-9\s.\-!@#$%^&*{}[\]'"/><~\\]*$/;
    
        if (value.length > 25) {
            field.setCustomValidity('Maximum 25 characters allowed');
            field.reportValidity();
            saveButton?.setAttribute('disabled', true);
        } else if (!regex.test(value)) {
            field.setCustomValidity('Only alphanumeric characters, spaces, and allowed punctuation are permitted');
            field.reportValidity();
            saveButton?.setAttribute('disabled', true);
        } else {
            field.setCustomValidity('');
            saveButton?.removeAttribute('disabled');
        }
    }

    async handleSaveButton(saveButton){
        const fixtureField = saveButton.closest('.fixture-type').querySelector('[edit-fixture-field]');
        const editButton = saveButton.closest('.fixture-type').querySelector('[edit-fixture-button]');
        const quantity = saveButton.closest('.cart-item')?.querySelector('.quantity__input')?.value || 1
        if(saveButton.hasAttribute('disabled')) return
        
        // line is 1 based index for the lineitem in this.cart.items
        const line = fixtureField.getAttribute('line');

        let resp = null;
        resp = await this.handleFixtureUpdate(line, fixtureField?.value, quantity);

        if(resp){
            this.toggleEditFixtureButton(editButton)
        }
    }

    async handleFixtureUpdate(line, fixtureValue, quantity){  
        if (!this.cart) return
        
        const allProperties = this.cart.items[line - 1].properties
        allProperties["Fixture Type"] = fixtureValue

        let formData = {
            "line": line,
            "properties": allProperties,
            "quantity": quantity
        };

        let cartResp = await fetch(window.Shopify.routes.root + 'cart/change.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
          })
          cartResp = await cartResp.json();
        return cartResp
    }

    handleCancelButton(e){

        const cancelButton = e.target;
        const editButton = cancelButton.closest('.fixture-type').querySelector('[edit-fixture-button]');
        const fixtureInputField = cancelButton.closest('.fixture-type').querySelector('[edit-fixture-field]');
        fixtureInputField.value = fixtureInputField.getAttribute('preserveValue');

        this.toggleEditFixtureButton(editButton);
    }

    toggleEditFixtureButton(editButton){
        
        const targetField = editButton.closest('.fixture-type').querySelector('[edit-fixture-field]')
        const targetCancelButton = editButton.closest('.fixture-type').querySelector('[cancel-edit-fixture-button]')
        const saveButton = editButton.closest('.fixture-type').querySelector('[save-fixture-button]')
        
        const preserveValue = targetField.value;

        if(targetField.hasAttribute('disabled')){
            targetField.removeAttribute('disabled')
            editButton.style.display = 'none';
            targetCancelButton.style.display = 'block';
            targetField.setAttribute('preserveValue', preserveValue)
            saveButton.style.display = 'block';
        }
        else {
            targetField.setAttribute('disabled', true)
            editButton.style.display = 'block';
            targetCancelButton.style.display = 'none';
            saveButton.style.display = 'none';
        }
    }
}
// const fixtureField = new FixtureTypeField()
customElements.define('custom-box', FixtureTypeField);