// these variable are defined in bom-calculator.liquid and are
// tenInchKitProduct, oneInchkitProduct, flatMountingKitProduct, driverProduct

document.addEventListener("DOMContentLoaded", () => {
    /* BOM Toggle Display */
    const cartNotification = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    const triggerBOMButton = document.getElementById("trigger-bom");
    const billOfMaterial = document.querySelector(".bill-of-material");
    let submitButton = document.querySelector('#pc-linear-add-to-cart');
    const submitButtonPreviousContent = submitButton.querySelector('span').innerText
    const totalLinearFootageElement = document.getElementById("total-linear-footage")
    const mountingTypeElement = document.getElementById("mounting-type")
    let bomGenerated = false;
    document.querySelector('.add-project-button')?.setAttribute('disabled', true);

    totalLinearFootageElement.addEventListener('change', handleTotalLinearFootageChange)
    totalLinearFootageElement.addEventListener('keyup', handleTotalLinearFootageChange)

    function handleTotalLinearFootageChange(event){
        handleBomButtonEnable(event)
        handleQuantityChange(event)
        calculateDriversAndWattage(event)
    }

    function calculateDriversAndWattage(e){
        //real time wattage and drivers update
        const footageBtn = document.getElementById("total-linear-footage");
        const totalLinearFootage = parseFloat(footageBtn.value) || 0; // Default to 0 if the value is not a number
        let drivers = calculateDrivers(totalLinearFootage);
        let wattage = calculateTotalWattage(totalLinearFootage);

        // Update the total-wattage display
        var wattageElement = document.getElementById('total-wattage');
        wattageElement.textContent = `${wattage.toFixed(2)}W`;

        // update the number of drivers
        var driversElement = document.getElementById('total-drivers');        
        driversElement.textContent = `${drivers}`;
    }

    
    

    function handleQuantityChange(event){
        const linearFootageValueError = document.querySelector('[total-linear-footage-error]')

        const value = event.target.value
        const min = event.target.getAttribute('min') ? parseInt(event.target.getAttribute('min')) : 1
        const max = event.target.getAttribute('max') ? parseInt(event.target.getAttribute('max')) : 9999
        
        const formatedValue = window.shopifyHelpers.handleQuantityChange(value, min, max)
        const {valid, error} = window.shopifyHelpers.isValueValid(value)
        if (!valid){
            linearFootageValueError.style.display = 'block'
            linearFootageValueError.innerText = error
        }
        else {
            linearFootageValueError.style.display = 'none'
            linearFootageValueError.innerText = ''
        }
        handleBomButtonEnable(event)
        totalLinearFootageElement.value = formatedValue
        totalLinearFootageElement.focus();
        totalLinearFootageElement.type = 'text';//have to change input type to text to reposition the cursor to the front and then set it back to number
        totalLinearFootageElement.setSelectionRange(formatedValue.length, formatedValue.length);
        totalLinearFootageElement.type = 'number';
    }

    function handleBomButtonEnable(event){
        
        const value = event.target.value
        const {valid} = window.shopifyHelpers.isValueValid(value)
        
        if(value && valid){
            triggerBOMButton.removeAttribute('disabled')
        }
        else {
            triggerBOMButton.setAttribute('disabled', true)
            document.querySelector('.add-project-button')?.setAttribute('disabled', true);
        }
    }

    function submitButtonLoading(loading){
        if(loading){
            submitButton.querySelector('span').innerText = "Loading..."
        }
        else {
            submitButton.querySelector('span').innerText = submitButtonPreviousContent
        }
    }

    function getCartNotificationSections(formData){
        if (cartNotification) {
          formData['sections'] = cartNotification.getSectionsToRender().map((section) => section.id)
          formData['sections_url'] =  window.location.pathname
          cartNotification.setActiveElement(document.activeElement);
        }
  
        return formData
    }

    function updateCartNotification(cartResp){
        if (cartNotification) {
          cartResp.items[0]['sections'] = cartResp.sections
          cartNotification.renderContents(cartResp.items[0]);
        }
    }
    
    triggerBOMButton?.addEventListener("click", (event) => {
        event.preventDefault(); // Prevent form submission if button is inside a form

        const totalLinearFootage = totalLinearFootageElement.value
        // const mountingType = document.getElementById("mounting-type").value;
        
        let  {
            tenInchKits,
            oneInchKits,
            mountingKits,
            drivers,
            fourtyFiveDegMountingKits,
        } = calculateBOM(totalLinearFootage);
        console.log("Hamza",calculateBOM(totalLinearFootage)    )
                const kitValues = {
        tenInchKits: tenInchKits,
        oneInchKits: oneInchKits,
        mountingKits: mountingKits,
        mountingKits45deg: fourtyFiveDegMountingKits,
        };

Object.entries(kitValues).forEach(([id, value]) => {
  // Use querySelectorAll in case there are multiple elements with same ID (or change to class)
  document.querySelectorAll(`#${id}`).forEach((el) => {
    el.value = value;
  });
});
         

        handleMountingTypeChange()

        document.getElementById("drivers").value = drivers;
        
        window.bomData = [
            {
                quantity: tenInchKits,
                product: {
                    id: tenInchKitProduct.id,
                    handle: tenInchKitProduct.handle,
                    title: tenInchKitProduct.title,
                    variants: tenInchKitProduct.variants,
                    images: tenInchKitProduct.media || []
                }
            },
            {
                quantity: oneInchKits,
                product: {
                    id: oneInchkitProduct.id,
                    handle: oneInchkitProduct.handle,
                    title: oneInchkitProduct.title,
                    variants: oneInchkitProduct.variants,
                    images: oneInchkitProduct.media || []
                }
            },
            {
                quantity: drivers,
                product: {
                    id: driverProduct.id,
                    handle: driverProduct.handle,
                    title: driverProduct.title,
                    variants: driverProduct.variants,
                    images: driverProduct.media || []
                }
            },
            {
                quantity: mountingKits,
                product: {
                    id: flatMountingKitProduct.id,
                    handle: flatMountingKitProduct.handle,
                    title: flatMountingKitProduct.title,
                    variants: flatMountingKitProduct.variants,
                    images: flatMountingKitProduct.media || []
                }
            }
        ];

        // window.dispatchEvent(new Event('bomDataUpdated'));
        
        billOfMaterial.style.display = "block";
        bomGenerated = true;
        updatePrice()
        submitButton.removeAttribute('disabled')
        document.querySelector('.add-project-button')?.removeAttribute('disabled');
        
    });

  function handleMountingTypeChange() {
  const mountingTypeElement = document.getElementById("mounting-type"); // assuming this exists

  const mountingKitElements = document.querySelectorAll("#mountingKits");
  const mountingKits45degElements = document.querySelectorAll("#mountingKits45deg");

  // loop over all matched elements
  mountingKitElements.forEach((el) => {
    const wrapper = el.closest('.bill-content');
    if (wrapper) {
      wrapper.style.display = (mountingTypeElement?.value === 'flat-track') ? "flex" : "none";
    }
  });

  mountingKits45degElements.forEach((el) => {
    const wrapper = el.closest('.bill-content');
    if (wrapper) {
      wrapper.style.display = (mountingTypeElement?.value === 'flat-track') ? "none" : "flex";
    }
  });
}


    const updatePrice = () => {
        const totalAmountElement = document.querySelector('.bill-price #total-amount');
        let inputElements = document.querySelectorAll('.bill-contents.enable input[name="quantity"]')
        inputElements = Array.from(inputElements).filter(item => parseInt(item.value) > 0)
        let totalPrice = 0
        if(inputElements.length){
            totalPrice = inputElements
            .reduce((total, ele) => { 
                const price = parseInt(ele.getAttribute('price'))
                const quantity = ele.value
                return total + (price * quantity) 
            }, 0)
        }

        totalAmountElement.textContent = window.shopifyHelpers.formatPrice(totalPrice)
    }

    const calculateBOM = (totalLinearFootage) => {
        let tenInchKits = Math.floor(totalLinearFootage / 10);
        let oneInchKits = Math.floor(totalLinearFootage % 10);
        let drivers = calculateDrivers(totalLinearFootage);
        let mountingKits = 0;
        let fourtyFiveDegMountingKits = 0;
        
        if(mountingTypeElement?.value === 'flat-track'){
            mountingKits = tenInchKits;
            if(oneInchKits > 0) mountingKits += 1;
        }
        else {
            fourtyFiveDegMountingKits = tenInchKits;
            if(oneInchKits > 0) fourtyFiveDegMountingKits += 1;
        }

        return {
            tenInchKits,
            oneInchKits,
            mountingKits,
            drivers,
            fourtyFiveDegMountingKits,
        }
    }

    /* BOM Quantity Field */
    const minusButtons = document.querySelectorAll(".quantity-btn.minus");
    const plusButtons = document.querySelectorAll(".quantity-btn.plus");

    minusButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
            
        const input = event.target?.closest('.quantity-control')?.querySelector('input');
        if (!input) return
        
        const currentValue = parseInt(input.value, 10);
        if (currentValue > parseInt(input.min, 10)) {
            input.value = currentValue - 1;
            // Trigger input change event for input
            const inputIncreaseEvent = new Event('change', { bubbles: true });
            input.dispatchEvent(inputIncreaseEvent);
        }
        });
    });

    plusButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
            const input = event.target?.closest('.quantity-control')?.querySelector('input');
            if (!input) return

            const currentValue = parseInt(input.value, 10);
            input.value = currentValue + 1;
            // Trigger input change event for input
            const inputDecreaseEvent = new Event('change', { bubbles: true });
            input.dispatchEvent(inputDecreaseEvent);
        });
    });

    mountingTypeElement?.addEventListener('change', (event) => {
        const value = event.target.value
        if(value === 'flat-track'){
            document.getElementById('mountingKits').value = 0
        }
        else {
            const totalLinearFootage = parseFloat(totalLinearFootageElement.value) || 0; // Default to 0 if the value is not a number
            document.getElementById('mountingKits').value = Math.floor(totalLinearFootage / 10);
        }
    })

    const calculateTotalWattage = (totalLinearFootage) => {
        return totalLinearFootage * 4;
    }

    const calculateDrivers = (totalLinearFootage) => {
        return Math.ceil(totalLinearFootage / 20); 
    }

    const newSubmitButton = submitButton.cloneNode(true);
    submitButton.parentNode.replaceChild(newSubmitButton, submitButton);
    submitButton = newSubmitButton; // Reassign to the new element


    submitButton.setAttribute('type', 'button');

    // Get the form element
    submitButton.addEventListener('click', async function(e) {
        e.preventDefault();
        
        if(bomGenerated){
            submitButtonLoading(true)
            let billInputs = document.querySelectorAll('.bill-of-material .bill-contents.enable input');
            let formData = {
                'items': []
            };
            
            const bundleId = `linear_${Date.now().toString()}`;
            const parentProductTitle = document.getElementById('parentProductTitle').value;
            const parentProductVariantId = document.getElementById('parentProductVariantId').value;
            const parentProductURL = document.getElementById('parentProductURL').value;
            
            // Get fixture type from custom input if available
            const fixtureTypeInput = document.querySelector('.fixture_input');
            const fixtureType = fixtureTypeInput ? fixtureTypeInput.value : '';

            const parentProductData = {
                title : parentProductTitle,
                url : parentProductURL,
                defaultVariantId: `gid://shopify/ProductVariant/${parentProductVariantId}`,
            }
            
            let itemsToAddCart = [];
            billInputs.forEach(item => {
                if(!item.value || item.value == 0) return;
                let data =  {
                    properties: {
                        "_bundleId" : bundleId,
                        "_parentProduct" : JSON.stringify(parentProductData),
                        "SKU" : item.getAttribute('sku'),
                        "Fixture Type": fixtureType // Add fixture type property to items
                    },
                    quantity: parseFloat(item.value),
                    id: parseInt(item.dataset.productId)
                }
                itemsToAddCart.push(data);
            })
            formData.items = itemsToAddCart;
            // console.log("formData:", JSON.stringify(formData, null, 2));
            formData = getCartNotificationSections(formData)
            fetch('/cart/add.js', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })
            .then(async (response) => {
                const respJson = await response.json();
                updateCartNotification(respJson)
            })
            .catch((error) => {
                console.error('Error:', error);
            })
            .finally(() => {
                submitButtonLoading(false)
            });
        }
    });

    // Initialize fixture type input if it exists
    const fixtureInput = document.querySelector('.fixture_input');
    if (fixtureInput) {
        fixtureInput.addEventListener('input', function(e) {
            // You can add validation or other functionality here if needed
            console.log("Fixture type updated:", e.target.value);
        });
    }
});