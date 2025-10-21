document.addEventListener("DOMContentLoaded", () => {
    /* BOM Toggle Display */
    const cartNotification = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    const triggerBOMButton = document.getElementById("trigger-bom-zone");
    const billOfMaterial = document.querySelector(".bill-of-material");
    // let submitButton = document.querySelector('#pc-linear-add-to-cart');
    // let submitButton = document.querySelector('[data-type="add-to-cart-form"] button[type="submit"]');
    let submitButton = document.querySelector('#pc-linear-add-to-cart')
    const submitButtonPreviousContent = submitButton.querySelector('span').innerText

    let bomGenerated = false;

    addChangeEventListener();

    function handleBomButtonEnable(){
    
        const everyFieldHasValue = Array.from(document.querySelectorAll('.total-linear-footage')).every(item => item.value && item.value > 0)

        if(everyFieldHasValue){
            triggerBOMButton.removeAttribute('disabled')
        }
        else {
            triggerBOMButton.setAttribute('disabled', true)
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

    function updateCartNotification(cartResp){
        if (cartNotification) {
          cartResp.items[0]['sections'] = cartResp.sections
          cartNotification.renderContents(cartResp.items[0]);
        }
    }
    
    triggerBOMButton.addEventListener("click", (event) => {
        event.preventDefault(); // Prevent form submission if button is inside a form

        // Initialize variables to accumulate the sums
        let totalTenInchKits = 0;
        let totalOneInchKits = 0;
        let totalMountingKits = 0;
        let totalDrivers = 0;
        let totalFourtyFiveDegMountingKits = 0;
        const allAccordions = document.querySelectorAll('.linear-accordion .accordion-content');
        allAccordions.forEach(acc => {
            let totalLinearFootage = acc.querySelector(".total-linear-footage");
            const mountingTypeElement = acc.querySelector(".mounting-type");
            let {tenInchKits, oneInchKits, mountingKits, drivers, fourtyFiveDegMountingKits} = calculateBOM(totalLinearFootage.value, mountingTypeElement);
             // Sum the values for each category
            totalTenInchKits += tenInchKits;
            totalOneInchKits += oneInchKits;
            totalMountingKits += mountingKits;
            totalDrivers += drivers;
            totalFourtyFiveDegMountingKits += fourtyFiveDegMountingKits;
            
        });
        
        document.getElementById("tenInchKits").value = totalTenInchKits;
        document.getElementById("oneInchKits").value = totalOneInchKits;
        document.getElementById("mountingKits").value = totalMountingKits;        
        document.getElementById("drivers").value = totalDrivers;
        document.getElementById("mountingKits45deg").value = totalFourtyFiveDegMountingKits;


        window.bomData = [
            {
                quantity: totalTenInchKits,
                product: {
                    id: tenInchKitProduct.id,
                    handle: tenInchKitProduct.handle,
                    title: tenInchKitProduct.title,
                    variants: tenInchKitProduct.variants,
                    images: tenInchKitProduct.media || []
                }
            },
            {
                quantity: totalOneInchKits,
                product: {
                    id: oneInchkitProduct.id,
                    handle: oneInchkitProduct.handle,
                    title: oneInchkitProduct.title,
                    variants: oneInchkitProduct.variants,
                    images: oneInchkitProduct.media || []
                }
            },
            {
                quantity: totalDrivers,
                product: {
                    id: driverProduct.id,
                    handle: driverProduct.handle,
                    title: driverProduct.title,
                    variants: driverProduct.variants,
                    images: driverProduct.media || []
                }
            },
            {
                quantity: totalMountingKits,
                product: {
                    id: flatMountingKitProduct.id,
                    handle: flatMountingKitProduct.handle,
                    title: flatMountingKitProduct.title,
                    variants: flatMountingKitProduct.variants,
                    images: flatMountingKitProduct.media || []
                }
            }
        ];

        window.dispatchEvent(new Event('bomDataUpdated'));

        hideElementsWithZeroQuantity()

        bomGenerated = true;
        billOfMaterial.style.display = "block";
        updatePrice()
        
        submitButton.removeAttribute('disabled')

    });

    function hideElementsWithZeroQuantity(){
        const inputElements = document.querySelectorAll('.bill-contents input[name="quantity"]')
        inputElements.forEach(item => {
            if(item.value == 0){
                item.closest('.bill-content').style.display = "none"
            }
            else {
                item.closest('.bill-content').style.display = "flex"
            }
        })
    }

    const calculateBOM = (totalLinearFootage, mountingTypeElement) => {
        
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
            fourtyFiveDegMountingKits
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
        }
        });
    });

    plusButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
            const input = event.target?.closest('.quantity-control')?.querySelector('input');
            if (!input) return

            const currentValue = parseInt(input.value, 10);
            input.value = currentValue + 1;
        });
    });

  

    /* Linear Accordions */

    // Add event listener for all .toggle-accordion elements
    document.addEventListener('click', function(event) {
        if (event.target && event.target.matches('.toggle-accordion')) {
            // Find the parent .linear-accordion element of the clicked accordion        
            const parentAccordion = event.target.closest('.linear-accordion');
            toggleAccordion(parentAccordion);
        }
        if(event.target && event.target.matches(".add-zone")) {
            addZone();
        }
        if(event.target && event.target.matches(".delete-zone")) {
            const parentAccordion = event.target.closest('.linear-accordion');
            if(parentAccordion) {
                const dataId = parentAccordion.getAttribute('data-id');
                deleteZone(dataId);
            }
        }
    
    });

    const toggleAccordion = (parentAccordion) => {
         // Get all .linear-accordion elements
         const allAccordions = document.querySelectorAll('.linear-accordion');
         // Loop through all accordions to close them
         allAccordions.forEach(acc => {
             // Close each accordion except the clicked one
             if (acc !== parentAccordion) {
                 acc.classList.remove('active'); // Assuming you add/remove the 'active' class to open/close accordion
                 
             }
         });

         // Toggle the clicked accordion (open/close)
         if (parentAccordion.classList.contains('active')) {
             parentAccordion.classList.remove('active');
             
         } else {
             parentAccordion.classList.add('active');
            
         }
    }

    // Add new accordion (zone)
   
    const addZone = () => {
        const accordionContainer = document.getElementById("linear-accordion-container");
        const newId = accordionContainer.children.length + 1;

        const newAccordion = document.createElement("div");
        newAccordion.className = "linear-accordion";
        newAccordion.setAttribute("data-id", newId);

        newAccordion.innerHTML = `
        
            <div class="accordion-header toggle-accordion">
                <span class="font-neue-roman accordion-title">Zone ${newId}</span>
                <div class="accordion-action-btns">
                    <button class="add-zone font-neue-roman">Add Zone</button>
                    <!-- Delete Zone button will be conditionally displayed by JavaScript -->
                    
                    <button class="delete-zone font-neue-roman">Delete Zone</button>
                </div>
                <svg class="accordion-plusIcon" width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.71667 0.5L6.71667 13.5M0 7H6.71667L13 7" stroke="#5A5857" stroke-width="1.5"></path>
                </svg>
                <svg class="accordion-minusIcon" width="13" height="2" viewBox="0 0 13 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 1L6.71667 1L13 1" stroke="#5A5857"></path>
                </svg>
            </div>
            <div class="accordion-content" style="height:auto;">
                <!-- Zone content here -->
                <div class="form-row">
                    <label class="form-labels font-neue-roman">Zone Name</label>
                    <input name="" type="text" class="field-styles font-neue-roman">
                </div>
                <div class="form-row">
                    <label class="form-labels font-neue-roman">Total Linear Footage of Fixtures 
                        <div class="tooltip">
                            <!-- Tooltip icon here -->
                        </div>
                    </label>
                    <input min="1" class="total-linear-footage field-styles" name="" type="number"  class="field-styles">
                </div>
                <div class="form-row select-styles">
                    <label class="form-labels font-neue-roman">Mounting Type</label>
                    <div class="select-box-styles">
                        <select class="mounting-type dropdown-styles font-neue-roman" name="" class="dropdown-styles font-neue-roman">
                            <option value="flat-track">Flat Track</option>
                            <option value="45-deg-track" >45 Degree Track</option>
                        </select>
                        <div class="select-arrow">
                            <svg width="17" height="10" viewBox="0 0 17 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.62282 8.4032L15.5 1.52625L14.974 1L8.545 7.40251L2.11603 1L1.59 1.52625L8.545 8.48125L8.62282 8.4032Z" fill="#292521" stroke="#292521"></path>
                            </svg>
                        </div>
                    </div>
                </div>
                <div class="form-row wattage-drivers">
                    <p class="zone-wattage font-neue-roman">Total Zone Wattage: <span class="total-wattage"></span></p>
                    <p class="zone-wattage font-neue-roman">Number of drivers needed: <span class="total-drivers"></span></p>
                    <p class="weight-100 italic font-size-15"> Max. 20' of fixtures per driver.</p>
                </div>
               
                
            </div>
        `;
        
        accordionContainer.appendChild(newAccordion);
        addChangeEventListener();
        // Automatically expand the newly added zone
        toggleAccordion(newAccordion);
        handleBomButtonEnable()
    }
   


    // Delete an accordion (zone)
    function deleteZone(id) {
        const accordionToDelete = document.querySelector(`.linear-accordion[data-id="${id}"]`);
        if (accordionToDelete) {
            accordionToDelete.remove();
            // Renumber remaining zones
            renumberZones();
        }
        
    }

    // Function to renumber zones after deletion
    function renumberZones() {
        const zones = document.querySelectorAll('.linear-accordion');
        zones.forEach((zone, index) => {
            if(index === 0) return; // Skip the first zone
            const newId = index + 1; // Zones should start from 1
            zone.setAttribute('data-id', newId);

            // Update the title to match the new zone number
            const title = zone.querySelector('.accordion-title');
            title.innerHTML = `<i class="fa-solid fa-angle-down"></i> Zone ${newId}`;

            // Update the delete button's onclick handler to match the new ID
            const deleteBtn = zone.querySelector('.delete-zone');
            deleteBtn.setAttribute('onclick', `deleteZone(event, ${newId})`);
        });
    }

    function handleQuantityChange(input){
        const value = input.value;
        const min = input.getAttribute('min') ? parseInt(input.getAttribute('min')) : 1;
        const max = input.getAttribute('max') ? parseInt(input.getAttribute('max')) : null;

        const formatedValue = window.shopifyHelpers.handleQuantityChange(value, min, max);

        input.value = formatedValue
        input.focus();
        input.type = 'text'; //have to change input type to text to reposition the cursor to the front and then set it back to number
        input.setSelectionRange(formatedValue.length, formatedValue.length);
        input.type = 'number';
    }
    
    function addChangeEventListener() {
        // Add an event listener to all inputs with the class 'total-linear-footage'
        attachEventsForLinearValueChange();
    }

    const updatePrice = () => {
        const totalAmountElement = document.querySelector('.bill-price #total-amount');
        const inputElements = document.querySelectorAll('.bill-contents input[name="quantity"]')
        let totalPrice = 0
        if(inputElements.length){
            totalPrice = Array.from(inputElements)
            .reduce((total, ele) => { 
                const price = parseInt(ele.getAttribute('price'))
                const quantity = ele.value
                return total + (price * quantity) 
            }, 0)

        }

        totalAmountElement.textContent = window.shopifyHelpers.formatPrice(totalPrice)

    }

    function calculateDriversAndWattage(input){
        //real time wattage and drivers update

        handleQuantityChange(input);
        // Get the parent accordion element for the current input
        let accordion = input.closest('.accordion-content');

        // Get the value of the input (the total linear footage)
        let totalLinearFootage = parseFloat(input.value) || 0; // Default to 0 if the value is not a number

        let drivers = calculateDrivers(totalLinearFootage);
        let wattage = calculateTotalWattage(totalLinearFootage);

        // Update the total-wattage display
        var wattageElement = accordion.querySelector('.total-wattage');
        wattageElement.textContent = `${wattage.toFixed(2)}W`;

        // update the number of drivers
        var driversElement = accordion.querySelector('.total-drivers');
        
        driversElement.textContent = `${drivers}`;
    }

    function attachEventsForLinearValueChange() {
        const totalLinearFootageElements = document.querySelectorAll('.total-linear-footage')
        totalLinearFootageElements.forEach(item => {
            item?.addEventListener('change', (e) => {
                calculateDriversAndWattage(e.target)
                handleBomButtonEnable()
                handleQuantityChange(input);
            })
            item?.addEventListener('keyup', (e) => {
                calculateDriversAndWattage(e.target)
                handleBomButtonEnable()
                handleQuantityChange(input);
            })
        })
    }

    

    const calculateTotalWattage = (totalLinearFootage) => {
        return totalLinearFootage * 4;
    }

    const calculateDrivers = (totalLinearFootage) => {
        return Math.ceil(totalLinearFootage / 20);
    }

    let form  = document.querySelector('[data-type="add-to-cart-form"]');
    
    submitButton?.setAttribute('type', 'button');

    function getCartNotificationSections(formData){
        if (cartNotification) {
          formData['sections'] = cartNotification.getSectionsToRender().map((section) => section.id)
          formData['sections_url'] =  window.location.pathname
          cartNotification.setActiveElement(document.activeElement);
        }
  
        return formData
    }


    // Get the form element
    submitButton?.addEventListener('click', async function(e) {
        e.preventDefault();  // Prevent form submission if needed (optional)
        
        if(bomGenerated){
            submitButtonLoading(true)
            let billInputs = document.querySelectorAll('.bill-of-material input');
            let formData = {
                'items': []
            };

            const bundleId = `linear_${Date.now().toString()}`;
            const parentProductTitle = document.getElementById('parentProductTitle').value;
            const parentProductVariantId = document.getElementById('parentProductVariantId').value;

            const parentProductURL = document.getElementById('parentProductURL').value;
           
            const parentProductData = {
                title : parentProductTitle,
                url : parentProductURL,
                defaultVariantId: `gid://shopify/ProductVariant/${parentProductVariantId}`,
            }
            let itemsToAddCart = [];
            billInputs.forEach(input => { 
                if(!input.value || input.value == 0) return;
                let data = {
                    properties: {
                        "_bundleId" : bundleId,
                        "_parentProduct" : parentProductData
                    },
                    quantity: parseFloat(input.value),
                    id: parseFloat(input.dataset.productId)
                }
                itemsToAddCart.push(data);
            });
            
            formData.items = itemsToAddCart;
            formData = getCartNotificationSections(formData)

            fetch(window.Shopify.routes.root + 'cart/add.js', {
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
    
});