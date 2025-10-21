// if(productConfigurationsObject){
//   console.log('product_cofigurations_object', productConfigurationsObject, productGallery) // variable accessable from 'product-customizer.liquid'
// }
 
// if(additionalSkus){
//   console.log('additionalSkus', additionalSkus) // variable accessable from 'product-customizer.liquid'
// }

// main funciton
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.pc_options').forEach(optionElement => {
      optionElement.addEventListener('change', (e => {
        handleOptionConditions()
        handleOptionListConditions()
        handleImageChange()
        handleDisclaimers()
        
        productCustomizer?.updateContent() 
        productCustomizer?.updateUrl()
        
        preselectSingleOptionsValues()
        logSelectedAndUnselectedRadios()
        displayBundleDetails()
        
        // Dynamic attribute values
        setDynamicSwatchWidths();
      }))
  })
  
})

async function displayBundleDetails(){
  
  // Fetch products without showing errors
  let products = await fetchProducts(false);
  const additioanlSkus = additioanlSkusObject.fetchAdditionalSkusToAddToCart() //some products requires additional skus to be passed along with them conditionally
  products = [...products, ...additioanlSkus]

  // Loop through all .pc-bundle-row elements where show_additional_sku_details_here is not "true"
  document.querySelectorAll('.pc-bundle-row').forEach(row => {
    const showAdditional = row.getAttribute('show_additional_sku_details_here');
    
    if (showAdditional === 'true') {
      // Skip, handled separately below
      return;
    }
    const optionSetSystemHandle = row.getAttribute('optionSetSystemHandle');
    // Find the product with matching optionSetSystemHandle
    const product = products.find(p => p.optionSetSystemHandle === optionSetSystemHandle);
    
    if (product) {
      row.querySelector('.pc-bundle-value').innerHTML = product.sku;
      row.querySelector('.pc-bundle-dash').style.display = 'block';
      row.querySelector('.pc-bundle-price').innerHTML = `$${product?.defaultVariant?.price?.amount} ${product?.defaultVariant?.price?.currencyCode}`;
      row.querySelector('.pc-bundle-price').style.display = 'block';
    } else {
      row.querySelector('.pc-bundle-value').innerHTML = '---';
      row.querySelector('.pc-bundle-dash').style.display = 'none';
      row.querySelector('.pc-bundle-price').style.display = 'none';
    }
  });

  // Handle additional SKUs target
  const installationOptiontarget = document.querySelector(`.pc-bundle-row[show_additional_sku_details_here='true']`)
  const installationOptionRequired = document.querySelector(`[optionsetsystemhandle="${installationOptiontarget.getAttribute('optionSetSystemHandle')}"] input[required]`)
  const installationOptionSelected = document.querySelector(`[optionsetsystemhandle="${installationOptiontarget.getAttribute('optionSetSystemHandle')}"] input:checked`)


  if((installationOptionRequired || additioanlSkus.length) && installationOptionSelected?.value !== "-"){
    installationOptiontarget.style.display = 'block'
    if(installationOptiontarget && additioanlSkus.length){
      let additioanlSkusDetails = ''
      for (let i = 0; i <= additioanlSkus.length; i++) {
        const additionalSku = additioanlSkus[i]
        
        if(additionalSku){
          additioanlSkusDetails += `<span class="pc-bundle-value">${additionalSku.sku}</span> - <span class="pc-bundle-price">$${additionalSku?.defaultVariant?.price?.amount} ${additionalSku?.defaultVariant?.price?.currencyCode}</span>,` 
        }
      }
      // Remove the last comma if present
      // If the string ends with "," or "-", remove it
      additioanlSkusDetails = additioanlSkusDetails.replace(/[,|-]\s*$/, '');
      installationOptiontarget.querySelector('.pc-bundle-value').innerHTML = additioanlSkusDetails
    }
    else {
      installationOptiontarget.querySelector('.pc-bundle-value').innerHTML = '---';
      installationOptiontarget.querySelector('.pc-bundle-dash').style.display = 'none';
      installationOptiontarget.querySelector('.pc-bundle-price').style.display = 'none';
    }
  }
  else {
    installationOptiontarget.style.display = 'none'
  }
  
}

function logSelectedAndUnselectedRadios() {

  const productCustomizerWrapper = document.querySelector('.product-customizer');

  if(!productCustomizer) return

  const {allElementsAreSelected, selectedRadioGroups, unselectedRadioGroups} = productCustomizer?.areAllRadiosValid(productCustomizerWrapper);

  //reset attribute
  document.querySelectorAll('.pc-option-set').forEach(optionSet => {
    optionSet.setAttribute('allRadioOptionsSelected', 'true');
  });

  // set attribute false if any one value is unset 
  unselectedRadioGroups.forEach(groupName => {
    const radios = productCustomizerWrapper.querySelectorAll(`input[name="${groupName}"]`);
    radios.forEach(radio => {
      const optionSet = radio.closest('.pc-option-set');
      if (optionSet) {
        optionSet.setAttribute('allRadioOptionsSelected', 'false');
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  logSelectedAndUnselectedRadios()

  const allOptions = document.querySelectorAll('.pc_options');
  for (let i = 0; i < allOptions.length; i++) {
    const option = allOptions[i]; 
    const condition_sets_and_relation = JSON.parse(option.getAttribute('condition_sets_and_relation').replaceAll('&quot;', '"'));
    option.condition_sets_and_relation = condition_sets_and_relation
  }
});

document.querySelector('.pc-form')?.addEventListener('submit', function(e){
  e.preventDefault()
  handleAddToCartClick() 
})

function log(logText){
  console.log(`%c${logText}`, 'color: orange; font-size: 16px;');
}

function preselectSingleOptionsValues(){
  const allSwathcWrappers = document.querySelectorAll('.options-wrapper')
  for (let i = 0; i < allSwathcWrappers.length; i++) {
    const swatchwrapper = Array.from(allSwathcWrappers[i].querySelectorAll('.pc-swatch'));

    const filtersSwatches = swatchwrapper.filter(swatch => {
      // const style = window.getComputedStyle(swatch);
      return swatch.querySelector('input').getAttribute('disabled') == null;
    });
    
    if (filtersSwatches.length == 1) {
      filtersSwatches[0].querySelector('input').click()
    }
    
  }
}

function handleDisclaimers() {
  const disclaimerContainer = document.querySelector('.global-disclaimer-container');
  const disclaimerTextElement = disclaimerContainer?.querySelector('.disclaimer-text');
  
  if (!disclaimerContainer || !disclaimerTextElement) return;
  
  // Reset disclaimer
  disclaimerContainer.style.display = 'none';
  disclaimerTextElement.textContent = '';
  disclaimerTextElement.style.color = '';
  
  // Collect all applicable disclaimers
  const applicableDisclaimers = [];
  
  const allOptionLists = document.querySelectorAll('.option-list');
  
  for (let i = 0; i < allOptionLists.length; i++) {
    const optionList = allOptionLists[i];
    const optionSetHandle = optionList.getAttribute('optionsethandle');
    const optionListHandle = optionList.getAttribute('optionlisthandle');
    
    // Fetch disclaimer data
    const disclaimerData = fetchDisclaimerData(optionSetHandle, optionListHandle);
    
    if (disclaimerData && disclaimerData.disclaimer_sets?.length > 0) {
      const shouldShowDisclaimer = checkIfConditionsAreValid(
        disclaimerData.disclaimer_sets, 
        disclaimerData.disclaimer_relation || 'AND'
      );
      
      if (shouldShowDisclaimer && disclaimerData.disclaimer_text) {
        applicableDisclaimers.push({
          text: disclaimerData.disclaimer_text,
          color: disclaimerData.disclaimer_text_color
        });
      }
    }
  }
  
  // Display disclaimers if any are applicable
  if (applicableDisclaimers.length > 0) {
    disclaimerContainer.style.display = 'block';
    // Display all applicable disclaimers with icon and message
    disclaimerTextElement.innerHTML = applicableDisclaimers.map(d => {
      const textStyle = `line-height: 25px;${d.color ? ` color: ${d.color};` : ''}`;
      return `
        <div class=\"disclaimer-item\" style=\"display:flex; align-items:flex-start; gap:8px; margin:10px 0;\">
          <div class=\"disclaimer-text\" style=\"${textStyle}\"> <img class=\"disclaimer-icon\" src=\"https://cdn.shopify.com/s/files/1/0921/7182/9618/files/26a0.png?v=1754397865\" alt=\"Disclaimer\" width=\"16\" height=\"16\" style=\"flex:0 0 auto; margin-top:2px;\" /> ${d.text}</div>
        </div>`;
    }).join('');
  }
}

function fetchDisclaimerData(optionSetHandle, optionListHandle) {
  // Loop through the option sets
  for (const optionSet of productConfigurationsObject.optionSets) {
    if (handelize(optionSet.option_set_title) === handelize(optionSetHandle)) {
      // Loop through the option lists within the option set
      for (const optionList of optionSet.option_lists) {
        if (handelize(optionList.option_list_title) === handelize(optionListHandle)) {
          return {
            disclaimer_text: optionList.disclaimer_text,
            disclaimer_text_color: optionList.disclaimer_text_color,
            disclaimer_relation: optionList.disclaimer_relation,
            disclaimer_sets: optionList.disclaimer_sets
          };
        }
      }
    }
  }
  return null;
}

class AdditioanlSkus{
  constructor(){
    this.skus = additionalSkus
    this.additioanlproducts = []
  }

  fetchAdditionalSkusToAddToCart(){
    let eligibleSkus = []
    const {additional_sku_sets} = this.skus

    if(additional_sku_sets){
      for (let i = 0; i < additional_sku_sets.length; i++) {
        const additionlSkuSet = additional_sku_sets[i];
        
        const ifConditionsAreValid = checkIfConditionsAreValid(additionlSkuSet.condition_sets, additionlSkuSet.relation, 'SYSTEM_OPTION_HANDLE')
        if(ifConditionsAreValid){
          eligibleSkus = [...eligibleSkus, ...additionlSkuSet.sku_list]
        }
        
      }
    }

    this.additioanlproducts = eligibleSkus.length ? eligibleSkus : [];
    window.latestAdditionalSkus = this.additioanlproducts;
    
    return this.additioanlproducts
  }
}
const additioanlSkusObject = new AdditioanlSkus()

class QuantitySelector{
  constructor(){
    this.minusButtons = document.querySelector('.js-qty__adjust.js-qty__adjust--minus')
    this.plusButtons = document.querySelector('.js-qty__adjust.js-qty__adjust--plus')
    this.quantityInput = document.querySelector('.js-qty__num')
    
    this.bindEvents()
  }

  bindEvents(){
    this.minusButtons?.addEventListener('click', () => {this.decrement()})
    this.plusButtons?.addEventListener('click', () => {this.increment()})
    this.quantityInput?.addEventListener('change', (e) => {this.handleQuantityChange(e.target.value)})
    this.quantityInput?.addEventListener('keyup', (e) => {this.handleQuantityChange(e.target.value)})
  }

  handleQuantityChange(value){
    this.quantityInput.value = window.shopifyHelpers.handleQuantityChange(value);
  }

  decrement(){
    if (!this.quantityInput) return
    const quantity = this.quantityInput.value
    
    if (quantity > 1){
      this.quantityInput.value = parseInt(quantity) - 1
    }
  }

  increment(){
    if (!this.quantityInput) return
    const quantity = this.quantityInput.value
    const maxavailableForSale = this.quantityInput.getAttribute('max') ? parseInt(this.quantityInput.getAttribute('max')) : null
    const continueSellingWhenOutOfStock = this.quantityInput.getAttribute('continue-selling-when-out-of-stock') 
    
    if( continueSellingWhenOutOfStock == 'deny' ){
      if(quantity < maxavailableForSale) this.quantityInput.value = parseInt(quantity) + 1
    }
    else {
      this.quantityInput.value = parseInt(quantity) + 1
    }
    
  }

}
const quantitySelector = new QuantitySelector()

// URL logic is encapsulated inside UrlManager class below

class UrlManager {
  constructor() {
    this.readUrlParams();
  }

  // Dynamic URL short param mapping (built from available options)
  indexToAlpha(index) {
    let s = ''
    let n = index
    while (n >= 0) {
      s = String.fromCharCode(97 + (n % 26)) + s
      n = Math.floor(n / 26) - 1
    }
    return s
  }

  collectOptionNamesFromDOM() {
    const inputs = document.querySelectorAll('.pc-swatch input[name]')
    const names = new Set()
    inputs.forEach(input => {
      const name = input.getAttribute('name')
      if (name) names.add(name)
    })
    return Array.from(names)
  }

  collectOptionNamesFromConfig() {
    try {
      if (!window.productConfigurationsObject?.optionSets) return []
      const names = []
      for (const optionSet of window.productConfigurationsObject.optionSets) {
        const setHandle = handelize(optionSet?.option_set_title)
        for (const optionList of optionSet?.option_lists || []) {
          const listHandle = handelize(optionList?.option_list_title)
          if (setHandle && listHandle) names.push(`${setHandle}__${listHandle}`)
        }
      }
      return Array.from(new Set(names))
    } catch (e) {
      return []
    }
  }

  buildParamMapsFromDOMAndConfig() {
    let names = this.collectOptionNamesFromDOM()
    if (!names.length) names = this.collectOptionNamesFromConfig()
    names.sort()
    const forward = {}
    const reverse = {}
    names.forEach((name, i) => {
      const longKey = `option_${name}`
      const shortKey = this.indexToAlpha(i)
      forward[longKey] = shortKey
      reverse[shortKey] = longKey
    })
    return { forward, reverse }
  }

  getParamMaps() {
    if (!window.__pcParamMaps) {
      window.__pcParamMaps = this.buildParamMapsFromDOMAndConfig()
    }
    return window.__pcParamMaps
  }

  // Value maps per option (built lazily from DOM)
  collectOptionValuesFromDOM(optionName) {
    const inputs = document.querySelectorAll(`.pc-swatch input[name="${optionName}"]`)
    const values = new Set()
    inputs.forEach(input => {
      const v = input.value
      if (v != null && v !== '') values.add(v)
    })
    return Array.from(values)
  }

  buildValueMapsForLongKey(longKey) {
    const optionName = longKey.replace('option_', '')
    const values = this.collectOptionValuesFromDOM(optionName).sort((a, b) => a.localeCompare(b))
    const forward = {}
    const reverse = {}
    values.forEach((v, i) => {
      const code = this.indexToAlpha(i)
      forward[v] = code
      reverse[code] = v
    })
    return { forward, reverse }
  }

  getValueMapsForLongKey(longKey) {
    if (!window.__pcValueMaps) window.__pcValueMaps = {}
    if (!window.__pcValueMaps[longKey]) {
      window.__pcValueMaps[longKey] = this.buildValueMapsForLongKey(longKey)
    }
    return window.__pcValueMaps[longKey]
  }

  readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const options = {};
    
    const { reverse } = this.getParamMaps()
    params.forEach((value, key) => {
      const expandedKey = reverse[key] || key
      if (expandedKey.startsWith('option_')) {
        const valueMaps = this.getValueMapsForLongKey(expandedKey)
        const decodedValue = valueMaps?.reverse[value] || value
        options[expandedKey.replace('option_', '')] = decodedValue;
      }
    });

    return options;
  }

  updateUrl(selectedOptions) {
    const params = new URLSearchParams();
    
    const { forward } = this.getParamMaps()
    Object.entries(selectedOptions).forEach(([handle, value]) => {
      const longKey = `option_${handle}`
      const shortKey = forward[longKey]
      const keyToUse = shortKey || longKey
      const valueMaps = this.getValueMapsForLongKey(longKey)
      const encodedValue = valueMaps?.forward[value] || value
      params.set(keyToUse, encodedValue)
    });

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }

  triggerChangeForFirstSwatchInput(){
    const firstSwatchInput = document.querySelector('.pc-swatch input');
    if (firstSwatchInput) {
      const event = new Event('change', { bubbles: true });
      firstSwatchInput.dispatchEvent(event);
    }
  }
}
var urlManager = new UrlManager()

class ConditionalSwatchImages{
  constructor() {
    this.swatchImageConditions = productConfigurationsObject?.swatch_image_conditions || []
    this.bindEvents()
  }

  bindEvents() {
    document.querySelectorAll('.pc_options').forEach(option => {
      option.addEventListener('change', () => {
        this.handleSwatchImageChange()
      })
    })
  }

  handleSwatchImageChange() {
    const allOptions = document.querySelectorAll('.pc_options')
  
    for (let i = 0; i < allOptions.length; i++) {
      const option = allOptions[i];
      const optionSetHandle = option.getAttribute('optionsethandle')
      const optionListHandle = option.getAttribute('optionlisthandle')
      const optionHandle = option.getAttribute('optionhandle')
    
      const conditionalSwatchImages = this.fetchConditionsForSwatchImages(optionSetHandle, optionListHandle, optionHandle)
      if(conditionalSwatchImages?.length){
        const image = this.getValidSwatchImageConditionSet(conditionalSwatchImages)
        
        if (image){
          this.changeSwatchImages(option, image);
        }
      }
    }
  }

  fetchConditionsForSwatchImages(optionSetHandle, optionListHandle, optionHandle) {
    // Loop through the option sets
    for (const optionSet of productConfigurationsObject.optionSets) {
      // Check if the option set handle matches
  
      if ( handelize(optionSet.option_set_title)  === handelize(optionSetHandle)) {
        // Loop through the option lists within the option set
        for (const optionList of optionSet.option_lists) {
          // Check if the option list handle matches
          
          if (handelize(optionList.option_list_title) === handelize(optionListHandle)) {
            // Loop through the options within the option list
            for (const option of optionList.options) {
              // Check if the option handle matches
              
              if ( handelize(option.option_handle)  === handelize(optionHandle)) {
                // Return the conditions for the matched option
                return  option.conditionalSwatchImages;
              }
            }
          }
        }
      }
    }
    
    // Return null if no matching conditions found
    return null;
  }

  changeSwatchImages(option, image){
    if (!option || !image) return 
    const element = document.getElementById(option.id)
    if (element){
      element.closest('.pc-swatch')?.querySelector('img')?.setAttribute('src', image)
    }
  }
  
  getValidSwatchImageConditionSet(swatchImageConditions){
    for (let i = 0; i < swatchImageConditions.length; i++) {
      const {conditionSets, relation, image} = swatchImageConditions[i];
      const allConditionsValid = checkIfConditionsAreValid(conditionSets, relation);
      if(allConditionsValid){
        return image;
      }
    }
    // if no condition set passes then dont change image 
    return null;
  }
}
var conditionalSwatchImages = new ConditionalSwatchImages();

class ProductCustomizer{
  constructor(){
    this.selectedOptions = []
    this.optionSets = []
    this.urlManager = new UrlManager()
    this.initFromUrl()
  }

  initFromUrl() {
    const urlOptions = this.urlManager.readUrlParams();
    
    Object.entries(urlOptions).forEach(([handle, value]) => {
      const input = document.querySelector(`input[name="${handle}"][value="${value}"]`);
      if (input) {
        input.checked = true;
        // Update the selected value label
        const optionWrapper = input.closest('.option-list');
        const titleElement = optionWrapper?.querySelector('h4 .selected-value');
        if (titleElement) {
          titleElement.textContent = input.closest('.pc-swatch')?.querySelector('.breakable-label')?.textContent;
        }
      }
    });

    // After all options are set, trigger necessary UI updates
    if (Object.keys(urlOptions).length > 0) {
      handleOptionConditions();
      handleOptionListConditions();
      handleImageChange();
      conditionalSwatchImages.handleSwatchImageChange();
      this.updateContent();
      
      setTimeout(() => {
        urlManager?.triggerChangeForFirstSwatchInput();
      }, 100);
    }
  }

  updateUrl() {
    const selectedOptions = {}
    document.querySelectorAll('.pc_options:checked').forEach(input => {
      selectedOptions[input.getAttribute('name')] = input.value
    })
    this.urlManager.updateUrl(selectedOptions)
  }

  async updateContent(){
    
    const productCustomizerWrapper = document.querySelector('.product-customizer');
    const {allElementsAreSelected} = this.areAllRadiosValid(productCustomizerWrapper);
    
    // only update content if all radio inputs are selected
    if(!allElementsAreSelected) {
      addToCartButton.disable()
      return 
    }

    let products = await fetchProducts();
    const additioanlSkus = additioanlSkusObject.fetchAdditionalSkusToAddToCart() //some products requires additional skus to be passed along with them conditionally
    products = [...products, ...additioanlSkus]
    const totalPrice = this.calculateTotalAmount(products)
    this.updateTotalPrice(totalPrice)
  }

  updateTotalPrice(price){
    const priceElement = document.querySelector('.pc-total-price #pc-ProductPrice')
    if(priceElement) priceElement.innerHTML = `$${price}`
  }

  calculateTotalAmount(payload) {
    let totalPrice = 0;
    
    payload.forEach(product => {
      totalPrice += parseFloat(product.defaultVariant.price.amount);
    });
    return totalPrice.toFixed(2);
  }

  areAllRadiosValid(parentElement) {
    const radioGroups = new Set();
    const radioButtons = parentElement.querySelectorAll('input[required][type="radio"]');
    let allRadiosSelected = true;
    const selectedRadioGroups = [];
    const unselectedRadioGroups = [];

    // Collect all unique radio group names
    radioButtons.forEach(radio => {
      radioGroups.add(radio.name);
    });

    // Check each group for a selected radio
    for (let groupName of radioGroups) {
      if (parentElement.querySelector(`input[name="${groupName}"]:checked`)) {
        selectedRadioGroups.push(groupName);
      } else {
        unselectedRadioGroups.push(groupName);
        allRadiosSelected = false;
      }
    }

    return {
      allElementsAreSelected: allRadiosSelected,
      selectedRadioGroups,
      unselectedRadioGroups
    };
  }

  handleAddToCartButtonState(productsResp, itemsToTgnore, showErrors = true){
    let optionSets = productConfigurationsObject?.optionSets 
    optionSets = optionSets.filter(item => item.displayOnlyClassItem !== 'true')
    
    //remove ignoreable items from the optionSets
    optionSets = optionSets.filter(item => {
      return !itemsToTgnore.find(ignoreableItem => ignoreableItem.optionSetSystemHandle == item.optionSetSystemHandle )
    });
    
    const itemsMissing = []
    let index = 0
    for (const [key, value] of Object.entries(productsResp)) {
      if(value.edges.length == 0 || !value.edges[0]?.node?.variants?.nodes[0]?.availableForSale){
        itemsMissing.push(optionSets[index]?.option_set_title)
      }
      index++;  
    }

    // console.log('itemsMissing', itemsMissing)
    if(itemsMissing.length){
      addToCartButton.disable()
      if(showErrors){
        errorMessageProductCustomizer.setMessage(`<b> This combination is currently unavailable for ${ itemsMissing.join(', ') } </b>. <br> Please review and adjust your selections.`)
        errorMessageProductCustomizer.show()
      }
    }
    else {
      const productCustomizerWrapper = document.querySelector('.product-customizer');
      const {allElementsAreSelected} = productCustomizer.areAllRadiosValid(productCustomizerWrapper);
      if(allElementsAreSelected){
        addToCartButton.enable()
      }
      if(showErrors){
        errorMessageProductCustomizer.removeMessage()
        errorMessageProductCustomizer.remove()

      }
    }
    
  }
  
}
var productCustomizer = new ProductCustomizer();

class Tabs {
  constructor() {
    this.tabs = document.querySelectorAll('.option-set-title')
    this.headerOffset = 120 // Adjust this value based on your fixed header height
    this.initializeAccordions()
    this.attachEventListener()
    this.attachInputEventListener()
  }

  initializeAccordions() {
    const allAccordions = document.querySelectorAll('.pc-option-set');

    allAccordions.forEach((accordion, index) => {
      const content = accordion.querySelector('.option-set-options-wrapper');
      const tab = accordion.querySelector('.option-set-title');
      const arrow = tab?.querySelector('span');

      // Only open the first accordion by default
      const shouldOpen = index === 0;

      if (shouldOpen) {
        content.style.display = "block";
        accordion.classList.add('activeAccordion');
        arrow?.classList.remove('rotate');
      } else {
        content.style.display = "none";
        accordion.classList.remove('activeAccordion');
        arrow?.classList.add('rotate');
      }
    });
  }

  attachEventListener() {
    this.tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.handleTabClick(e.target)
      })
    })
  }

  attachInputEventListener() {
    // Add event listener for the specific input that should trigger accordion opening
    document.addEventListener('change', (e) => {
      if (e.target.matches('input[optionlisthandle="trim-type"][optionhandle="flangeless"]')) {
        this.openTargetAccordion('Installation Options');
        this.openTargetAccordion('Accessories');
      }
      
      // Close Installation Options and Accessories accordions for other trim-type options
      if (e.target.matches('input[optionlisthandle="trim-type"][optionhandle="micro-flange"]') || 
          e.target.matches('input[optionlisthandle="trim-type"][optionhandle="decorative"]') || 
          e.target.matches('input[optionlisthandle="trim-type"][optionhandle="flanged"]')) {
        this.closeTargetAccordion('Installation Options');
        this.closeTargetAccordion('Accessories');
      }
    });
  }

  openTargetAccordion(accordionTitle) {
    // Find the target accordion
    const targetAccordion = document.querySelector(`.pc-option-set[optionsettitle="${accordionTitle}"]`);
    
    if (targetAccordion) {
      // Find the parent accordion of the clicked input
      const clickedInput = document.querySelector('input[optionlisthandle="trim-type"][optionhandle="flangeless"]');
      const parentAccordion = clickedInput?.closest('.pc-option-set');
      
      // Open the target accordion (don't close others, just ensure this one is open)
      const content = targetAccordion.querySelector('.option-set-options-wrapper');
      const tab = targetAccordion.querySelector('.option-set-title');
      const arrow = tab?.querySelector('span');
      
      content.style.display = "block";
      targetAccordion.classList.add('activeAccordion');
      if (arrow) arrow.classList.remove('rotate');

      // Scroll to the target accordion
      // setTimeout(() => {
      //   const targetPosition = tab.getBoundingClientRect().top + window.pageYOffset;
      //   const offsetPosition = targetPosition - this.headerOffset;
        
      //   window.scrollTo({
      //     top: offsetPosition,
      //     behavior: 'smooth'
      //   });
      // }, 100);
    }
  }

  closeTargetAccordion(accordionTitle) {
    // Find the target accordion
    const targetAccordion = document.querySelector(`.pc-option-set[optionsettitle="${accordionTitle}"]`);
    
    if (targetAccordion) {
      const content = targetAccordion.querySelector('.option-set-options-wrapper');
      const tab = targetAccordion.querySelector('.option-set-title');
      const arrow = tab?.querySelector('span');
      
      content.style.display = "none";
      targetAccordion.classList.remove('activeAccordion');
      if (arrow) arrow.classList.add('rotate');
    }
  }

  handleTabClick(target) {
    const clickedContent = target.parentElement.querySelector('.option-set-options-wrapper')
    const arrow = target.querySelector('span')
    const isCurrentlyOpen = clickedContent.style.display === "block"

    // If clicking an open accordion, close it
    if (isCurrentlyOpen) {
      clickedContent.style.display = "none"
      target.parentElement.classList.remove('activeAccordion')
      if (arrow) arrow.classList.add('rotate')
      return
    }

    // Close all accordions first
    this.tabs.forEach(tab => {
      const content = tab.parentElement.querySelector('.option-set-options-wrapper')
      const arrow = tab.querySelector('span')
      content.style.display = "none"
      tab.parentElement.classList.remove('activeAccordion')
      if (arrow) arrow.classList.add('rotate')
    })

    // Open clicked accordion
    clickedContent.style.display = "block"
    target.parentElement.classList.add('activeAccordion')
    if (arrow) arrow.classList.remove('rotate')

    // Scroll with offset for fixed header
    // setTimeout(() => {
    //   const targetPosition = target.getBoundingClientRect().top + window.pageYOffset
    //   const offsetPosition = targetPosition - this.headerOffset
      
    //   window.scrollTo({
    //     top: offsetPosition,
    //     behavior: 'smooth'
    //   })
    // }, 100)
  }
}

// Initialize tabs
var tabs = new Tabs()

class AddToCartButton{
  constructor(){
    this.button = document.querySelector('.pc-add-to-cart')
  }

  enable(){
    this.button?.removeAttribute('disabled', false)
    if(this.button){
      this.button.textContent = 'Add to Cart'
    }
  }

  disable(){
    this.button?.setAttribute('disabled', true)
    if(this.button){
      this.button.textContent = 'Make Selections'
    }
  }

  loading(loading){
    const currentContent = this.button.textContent
    if(loading){
      this.button?.setAttribute('disabled', true)
      if(this.button){
        this.button.textContent = 'Loading...'
      }
    }
    else {
      this.button?.removeAttribute('disabled', false)
      if(this.button){
        this.button.textContent = "Add to Cart"
      }
    }
  }
  
}
var addToCartButton = new AddToCartButton()

class ErrorMessageProductCustomizer{
  constructor(){
    this.errorContainer = document.querySelector('.pc-error')
  }

  setMessage(errorMessage){
    if(errorMessage && this.errorContainer) this.errorContainer.innerHTML = errorMessage
  }

  removeMessage(){
    if (this.errorContainer) this.errorContainer.textContent = ''
  }

  show(){
    if (this.errorContainer) this.errorContainer.classList.remove('hide')
  }

  remove(){
    if (this.errorContainer) this.errorContainer.classList.add('hide')
  }
} 
var errorMessageProductCustomizer = new ErrorMessageProductCustomizer()

async function fetchProducts(showErrors = true){
  const {itemsToAddCart, itemsToTgnore} = fetchItemsToAddToCart();
  // console.log('itemsToAddCart', itemsToAddCart)
  const {variables, query} = fetchQueryAndVariables(itemsToAddCart)
  // console.log('variables', variables)
  const productsResp = await APIFetch(query, variables)
  // console.log('productsResp', productsResp)
  // Loop through productsResp?.data and add optionSetSystemHandle and optionSetHandle from itemsToAddCart
  if (productsResp?.data && Array.isArray(itemsToAddCart)) {
    let index = 0;
    for (const key in productsResp.data) {
      if (productsResp.data.hasOwnProperty(key)) {
        const entry = productsResp.data[key];
        if (itemsToAddCart[index]) {
          entry.optionSetSystemHandle = itemsToAddCart[index].optionSetSystemHandle;
          entry.optionSetHandle = itemsToAddCart[index].optionSetHandle;
        }
        index++;
      }
    }
  }

  let products = extractProductsFromData(productsResp?.data || [])
  products = await getB2bCatalogPrice(products)
  productCustomizer?.handleAddToCartButtonState(productsResp?.data || {}, itemsToTgnore, showErrors)
  
  return products
}

async function getB2bCatalogPrice(products){
  // For each product, fetch its Shopify JSON data by handle
  // and update the price of the product
  // because the price from search api is not b2b catalog price
  for (const product of products) {
    let handle = product.handle;
    const response = await fetch(`${window.location.origin}/products/${handle}.json`);
    const data = await response.json();
    product.defaultVariant.price.amount = data.product.variants[0].price
  }
  return products
}



async function handleAddToCartClick(){

  let products =  await fetchProducts();
  products.push(...additioanlSkusObject.additioanlproducts)
  
  cart.addToCartV2(products); //defined in another file cartClass.js
}
 
function fetchQueryAndVariables(itemsToAddCart){
  let variables = {
    "query": "", 
    "first": 100
  }

  let variableParameters = ''
  let innerQuery = ''

  for (let i = 0; i < itemsToAddCart.length; i++) {
    const productCount = i+1
    const filterName = `productFilters${productCount}`
    const optionSet = itemsToAddCart[i]

    const metafieldValueToSearch = getMetafieldValueToSearch(optionSet)
    variables[filterName] = getProductfilterObject(metafieldValueToSearch)
    variableParameters += `,$${filterName}: [ProductFilter!]`
    innerQuery += getInnerQueryElement(filterName, productCount)
  }

  const query = `
  query searchProducts($query: String!, $first: Int, ${variableParameters}) {
    ${innerQuery}
  }`

  return {variables, query}
}

function getMetafieldValueToSearch(payload){
  const { selectedOptionValues } = payload;
  return selectedOptionValues.map(option => `${option.optionListTitle}: ${option.value}`).join(', ');
}

function getInnerQueryElement(filterName, index){
  return `
  product${index} : search( productFilters: ${'$' + filterName}, query: $query, first: $first, types: PRODUCT) {
    edges {
      node {
        __typename
        ... on Product {
          id
          title
          handle
          variants(first:10){
            nodes{
              id
              title
              sku
              price{
                amount
                currencyCode
              }
              availableForSale
            }
          }
            images(first: 1) {
            edges {
              node {
                url
              }
            }
          }
          metadata: metafield(namespace:"custom", key:"metadataoptions"){
            value
          }
          class: metafield(namespace:"custom", key:"class_name"){
            value
          }
        }
      }
    }
  }`
}

function getProductfilterObject(query){
  return {
    "productMetafield": {
       "namespace": "custom",
       "key": "metadataoptions",
       "value": query
     } 
  }

}

function fetchItemsToAddToCart(){
  const itemsToAddCart = [];
  const itemsToTgnore = [];

  // item classes with kit_product_shape_values value true will not be triggering image change or will be considered 
  // to add an item to cart they are only for making some logical conditions on the fronent
  document.querySelectorAll('.pc-option-set:not(.kit_product_shape_values):not([blockdefaultmetadatasearch="true"])').forEach(optionSet => {
    
    const ifValid = validateAddToCartConditions(optionSet) //if these conditions are valid then the item will not be added to cart
    
    if(!ifValid){ 
      // only add those items to array for which customer has selected some value , some options can be optional
      const ifSelectedValueExist = optionSet.querySelector('.pc_options:checked')
      
      if(ifSelectedValueExist){
        itemsToAddCart.push({
          optionSetHandle : optionSet.getAttribute('optionSetTitle'),
          selectedOptionValues : getSelectedOptionValues(optionSet),
          optionSetSystemHandle: optionSet.getAttribute('optionsetsystemhandle')
        })
      }
    }
    else {
      itemsToTgnore.push({
        optionSetHandle : optionSet.getAttribute('optionSetTitle'),
        selectedOptionValues : getSelectedOptionValues(optionSet),
        optionSetSystemHandle: optionSet.getAttribute('optionsetsystemhandle')
      })
    }

  })
  
  
  return {itemsToAddCart, itemsToTgnore}
}

function validateAddToCartConditions(optionSet){
  //if these conditions are not met then the item will not be added to cart

  let optionSetWithConditions = productConfigurationsObject?.optionSets?.find(item => item.optionSetSystemHandle == optionSet.getAttribute('optionSetSystemHandle'))
  
  const conditionSets = optionSetWithConditions?.condition_sets
  const relation = optionSetWithConditions?.relation
  
  if(!conditionSets?.length) return false

  let allConditionsValid = false
  if(conditionSets.length && relation){
    allConditionsValid = checkIfConditionsAreValid(conditionSets, relation)
  }
  return allConditionsValid
}

function getSelectedOptionValues(optionSet){
  return Array.from(optionSet.querySelectorAll('input:checked')).map(item => { return {optionListTitle : item.getAttribute('optionListTitle'), value: item.value} })
}

function createImageSearchQuery(imageName){
  let query = 'img'
  for (let i = 0; i < imageName.length; i++) {
    const querySubString = imageName[i];

    if(imageName.length > 1){
      if(i == 0) query += `[alt^="${querySubString}_"]` //start of query
      else if(i == imageName.length - 1) query += `[alt*="_${querySubString}_"]` //end of query
      else query += `[alt*="_${querySubString}_"]` // middle of query
    }
    else {
      query += `[alt*="${querySubString}_"]`
    } 
  }
  
  // console.log("%cImage query old pattern", "color:green", imageName.join('_'))
  return query;
}

function handleImageChange(){

  // Build imageName array by looping through each .options-wrapper
  let imageName = [];
  document.querySelectorAll('.options-wrapper').forEach(wrapper => {

    // Only proceed if the wrapper has an element with attribute triggerimagechange="True"
    if (!wrapper.querySelector('[triggerimagechange="True"]')) {
      return;
    }
    const hasAnyBlockImageAtAttirbuteValue = wrapper.querySelector('[triggerimagechange="False"]');

    
    const checkedInput = wrapper.querySelector('input:checked');
    const triggerImageChange = checkedInput?.closest('.pc-swatch').getAttribute('triggerimagechange');
    
    if (checkedInput && triggerImageChange == 'True') {
      // fetch image for checked input and if triggerimagechange is True
      imageName.push(checkedInput.getAttribute('optionId'));
    } else if(!hasAnyBlockImageAtAttirbuteValue)  {
      /*
        If no option is checked, use the first required input—unless there are "mixed results".
        "Mixed results" occur when image change should only be triggered for some attribute values,
        but not all. In such cases, do not automatically select the first option to show its image.
      */
      const firstInput = wrapper.querySelector('input:not([disabled])');
      if (firstInput && firstInput.required) {
        imageName.push(firstInput.getAttribute('optionId'));
      }
    }
  });
  
  imageName = imageName?.filter(Boolean);
  log(`imageName ${imageName.join('_')}` )
  
  const firstMatch = productGallery.find(img =>
    imageName.every((term, index) => {
      let termName = null;

      if(index == 0){
        // first
        termName = term + "_" ;
      }
      else {
        // middle and end
        termName = "_" + term + "_";
      }

      return img.alt?.includes(termName)
    })
  );

  const baseAlt = firstMatch?.alt?.split('__')[0]; // e.g., "4HSR_4HITCP_4MMTA_4TSR_4TTTFL_4TTSH_4TTFB"
  if (!baseAlt) return

  // Step 3: Filter all productGallery starting with that baseAlt
  const imageTargets = productGallery.filter(img =>
    img.alt?.startsWith(`${baseAlt}__`)
  );

  const currentImages = document.querySelector('.product__media-list').querySelectorAll('.product__media img')
  currentImages.forEach((targetImageEl, index) => {
    
    const baseSrc = imageTargets[index]

    const widths = [990, 1100, 1206, 1346, 1426, 1646, 1946];
    const srcset = widths.map(w => `${baseSrc.src}&width=${w} ${w}w`).join(', ');
    targetImageEl.srcset = srcset;

    targetImageEl.src = baseSrc.src;
    targetImageEl.alt = baseSrc.alt;
    targetImageEl.width = baseSrc.width;
    targetImageEl.height = baseSrc.height;
    targetImageEl.product_handle = baseSrc.product_handle;

  })
  
}

function hideAllImages(){
  const galleryWrapper = document.querySelector('.product__media-list')
  galleryWrapper.querySelectorAll(`.product__media-item`).forEach(item => {
    item.classList.add('hidden')
    item.classList.remove('targeted-image')
  })

  // hideShowMoreContainer()
}

function hideShowMoreContainer(){
  const showMoreContainer = document.querySelector('.show-buttons-container')
  const showLessButton = document.querySelector('#show-more-button')
  if(showMoreContainer) showMoreContainer.classList.add('hidden');
  if(showLessButton) showLessButton.classList.add('hidden');
}

function showshowMoreContainer(){
  const showMoreContainer = document.querySelector('.show-buttons-container')
  const showLessButton = document.querySelector('#show-more-button')
  if(showMoreContainer) showMoreContainer.classList.remove('hidden');
  if(showLessButton) showLessButton.classList.remove('hidden');
}

function handleOptionListConditions(){
  const allOptions = document.querySelectorAll('.option-list')
  
  for (let i = 0; i < allOptions.length; i++) {
    const option = allOptions[i];
    const optionSetHandle = option.getAttribute('optionsethandle')
    const optionListHandle = option.getAttribute('optionlisthandle')
    // if (optionListHandle == 'accessories') debugger
    const {conditionSets, relation} = fetchOptionListConditions(optionSetHandle, optionListHandle)
    
    if(conditionSets?.length){
      
      const allConditionsValid = checkIfConditionsAreValid(conditionSets, relation)
      const elementToEffect = document.querySelectorAll(`input[optionsethandle="${optionSetHandle}"][optionlisthandle="${optionListHandle}"]`)
      
      if(allConditionsValid){
        setMultipleHtmlElementRequired(elementToEffect, true)
      }
      else {
        setMultipleHtmlElementRequired(elementToEffect, false)
      }
    }
  }
}

function setMultipleHtmlElementRequired(elements, value){
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if(value == true){
      element.setAttribute('required', true)
    }
    else {
      if(element.getAttribute('required')){
        element.removeAttribute('required')
        element.checked = false
      }
    }   
  }
}

function handleOptionConditions(){
  const allOptions = document.querySelectorAll('.pc_options')
  
  for (let i = 0; i < allOptions.length; i++) {
    const option = allOptions[i];
    const optionSetHandle = option.getAttribute('optionsethandle')
    const optionListHandle = option.getAttribute('optionlisthandle')
    const optionHandle = option.getAttribute('optionhandle')
    

    /* [to be removed] this approach took 2,576ms or 2,641ms or 2,845ms, 2,503, 2,282, 2,372 */
    // const condition_sets_and_relation = JSON.parse(option.getAttribute('condition_sets_and_relation').replaceAll('&quot;', '"'));
    // const condition_sets_and_relation = option.getAttribute('condition_sets_and_relation');
    
    const conditionSets = option?.condition_sets_and_relation?.conditionSets
    const relation = option?.condition_sets_and_relation?.relation
    
    /* [to be removed] this approach took 2,387ms, 2,699 or 3,161 , 2,446, 2,385, 3,000 */
    // const {conditionSets, relation} = fetchConditions(optionSetHandle, optionListHandle, optionHandle)
    
    if(conditionSets?.length){
      const allConditionsValid = checkIfConditionsAreValid(conditionSets, relation)

      const elementToEffect = document.querySelector(`[optionsethandle="${optionSetHandle}"][optionlisthandle="${optionListHandle}"][optionhandle="${optionHandle}"]`)
      
      if(allConditionsValid){
        elementToEffect.setAttribute('disabled', true)
        elementToEffect.checked = false
      }
      else {
        elementToEffect.removeAttribute('disabled')
      }
      
    }
  }

  hideClassesWithAllChildItemsDisabled()
}

function hideClassesWithAllChildItemsDisabled(){

  const parentClasses = document.querySelectorAll('.product-customizer .pc-option-set');
  for (let i = 0; i < parentClasses.length; i++) {
    const parent = parentClasses[i];
    const children = parent.querySelectorAll('.options-wrapper .pc-swatch input');
  
    const allHidden = Array.from(children).every(child => {
      return child.disabled === true
    });
  
    if (allHidden) {
      parent.style.display = 'none';
    }
    else if(parent.style.display == 'none' ) {
      parent.style.display = 'block';
    }
  }
}

function triggerChange(element){
  element?.dispatchEvent(new Event('change', { bubbles: true }))
}

function checkIfConditionsAreValid(conditions, relation  = "AND", checkConditionAgainst = 'VALUE'){
  for (let i = 0; i < conditions.length; i++) {
      const conditionSet = conditions[i];
      const conditionSetValid = validateConditionSets(conditionSet.conditions, conditionSet.relation, checkConditionAgainst)
      if(relation == "AND"){
        // if we get any false value then return false for AND operation
        if(conditionSetValid != true) return false 
      }
      else {
        // if we get any true value return true for OR operation
        if(conditionSetValid == true) return true
      }
  }
  if(relation == "AND"){
    //if no condition is in-valid i.e false for AND condition then return true
    return true
  }
  else {
    //if no condition is valid i.e true for OR condition then return false 
    return false
  }
}

function validateConditionSets(conditions, relation = "AND", checkConditionAgainst = "VALUE" ) {
  const optionsWrapperElement = document.querySelector('.product__info-wrapper');
  
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];

    /* modify this instead of querySelector use JS Array */
    const targetElement = optionsWrapperElement.querySelector(
      `[optionsethandle="${condition.conditonOptionSetTitle}"][optionlisthandle="${condition.conditonOptionListTitle}"]:not([disabled]):checked`
    );
    // debugger
    const allAvailableValues = Array.isArray(condition?.values)
      ? condition.values 
      : JSON.parse(condition.values);

    let targetValue = "";
    if (checkConditionAgainst === "VALUE") {
      targetValue = targetElement?.value.trim();
    } else if (checkConditionAgainst === "SYSTEM_OPTION_HANDLE") {
      targetValue = targetElement?.getAttribute("systemoptionhandle")?.trim();
    }

    // boolean match
    const isMatch = allAvailableValues?.some(
      (item) => item.trim() === targetValue
    );

    if (relation === "AND") {
      if (!isMatch) return false; // fail fast
    } else {
      if (isMatch) return true; // succeed fast
    }
  }

  // if we get here, all ANDs passed or all ORs failed
  return relation === "AND";
}


function fetchConditions(optionSetHandle, optionListHandle, optionHandle) {
    // Loop through the option sets
    for (const optionSet of productConfigurationsObject.optionSets) {
      // Check if the option set handle matches
      
      if ( handelize(optionSet.option_set_title)  === handelize(optionSetHandle)) {
        // Loop through the option lists within the option set
        for (const optionList of optionSet.option_lists) {
          // Check if the option list handle matches
          
          if (handelize(optionList.option_list_title) === handelize(optionListHandle)) {
            // Loop through the options within the option list
            for (const option of optionList.options) {
              // Check if the option handle matches
              
              if ( handelize(option.option_handle)  === handelize(optionHandle)) {
                // Return the conditions for the matched option
                return {
                  conditionSets : option.conditionSets, 
                  relation: option.relation
                };
              }
            }
          }
        }
      }
    }
    
    // Return null if no matching conditions found
    return {conditionSets: [], relation: null};
}

function fetchOptionListConditions(optionSetHandle, optionListHandle) {
  // Loop through the option sets

  for (const optionSet of productConfigurationsObject.optionSets) {
    // Check if the option set handle matches
    
    if ( handelize(optionSet.option_set_title)  === handelize(optionSetHandle)) {
      // Loop through the option lists within the option set
      for (const optionList of optionSet.option_lists) {
        // Check if the option list handle matches
        if (handelize(optionList.option_list_title) === handelize(optionListHandle)) {
          // Loop through the options within the option list  
          return {
            conditionSets : optionList.condition_sets, 
            relation: optionList.relation
          };
        }
      }
    }
  }
  
  // Return null if no matching conditions found
  return {conditionSets: [], relation: null};
}

function handelize(value) {
  
  return value
    ?.toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove all special characters except hyphens
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .replace(/\s+/g, '-'); // Replace spaces with hyphens

}

async function APIFetch(query, variables)
{
    try {
        const API_ENDPOINT = `${shopUrl}/api/2024-07/graphql.json`
        const options = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Storefront-Access-Token': window.shopifyStorefrontAccessTokens[shopUrl],
            }
        };
        const request = {
            query: query,
            variables: variables
        };

        let response = await fetch(API_ENDPOINT, {
            ...options,
            body: JSON.stringify(request)
        })

        let resp = await response.json();

        const productApiData = document.getElementById('product-api-data');
        if (productApiData) {
            productApiData.setAttribute('data-api-response', JSON.stringify(resp));
            // Dispatch an event to notify that data is ready
            productApiData.dispatchEvent(new CustomEvent('api-data-ready', { detail: resp }));
        }
        
        const additionalSkus = additioanlSkusObject.fetchAdditionalSkusToAddToCart();
        const customEvent = new CustomEvent('productCustomizerAPIResponse', {
            detail: {
                ...resp,
                additionalSkus
            }
        });
        document.dispatchEvent(customEvent);
        
        return resp
        
    } catch (error) {
        console.log('Error: APIFetch()---:', error)
    }
}

function extractProductsFromData(payload){
  const products = [];
  
  for (const key in payload) {
    if (payload[key].edges && payload[key].edges.length > 0) {
      for (const item of payload[key].edges) {
        const productNode = item.node;
        let featured_image_url = '';
        if (productNode.images && productNode.images.edges && productNode.images.edges.length > 0) {
          featured_image_url = productNode.images.edges[0].node.url;
        }
        products.push({
          id: productNode.id,
          title: productNode.title,
          defaultVariantId: productNode.variants?.nodes[0]?.id,
          defaultVariant: productNode.variants?.nodes[0],
          metadata: productNode.metadata?.value,
          class: productNode.class?.value,
          sku: productNode.variants?.nodes[0]?.sku,
          handle: productNode.handle,
          availableForSale: productNode.variants?.nodes[0]?.availableForSale,
          featured_image_url: featured_image_url,
          optionSetHandle : payload[key].optionSetHandle,
          optionSetSystemHandle : payload[key].optionSetSystemHandle
        });
      }
    }
  }

  return products;
}

// Dynamic Attribute Values
function setDynamicSwatchWidths() {
  const optionsWrappers = document.querySelectorAll('.options-wrapper.has-swatch-style');
  
  optionsWrappers.forEach(wrapper => {
    // Get visible swatches (not disabled)
    const visibleSwatches = wrapper.querySelectorAll('.pc-swatch:has(input:not([disabled="true"]))');
    const swatchCount = visibleSwatches.length;
    
    if (swatchCount === 0) return;
    
    let width = '100%'; // default
    
    // For more than 10 items, use 50% width as default
    if (swatchCount > 10) {
      width = 'calc(50% - 7px)'; // 50% minus gap
    } else {
      // Determine width based on size class and count (only for 1-10 items)
      if (wrapper.classList.contains('has-size-4')) {
        // Size 4 logic - only for 1-10 items
        switch(swatchCount) {
          case 1:
          case 2:
          case 4:
          case 7:
          case 10:
            width = 'calc(50% - 7px)'; // 50% minus gap
            break;
          case 3:
          case 5:
          case 6:
          case 8:
          case 9:
            width = 'calc(33.33% - 10px)'; // 33.33% minus gap
            break;
        }
      } else if (wrapper.classList.contains('has-size-5')) {
        // Size 5 logic - only for 1-10 items
        switch(swatchCount) {
          case 1:
          case 2:
            width = 'calc(50% - 7px)'; // 50% minus gap
            break;
          case 3:
          case 5:
          case 6:
          case 9:
            width = 'calc(33.33% - 10px)'; // 33.33% minus gap
            break;
          case 4:
          case 7:
          case 8:
          case 10:
            width = 'calc(25% - 11px)'; // 25% minus gap
            break;
        }
      }
    }
    
    // Apply width to all visible swatches in this wrapper
    visibleSwatches.forEach(swatch => {
      swatch.style.width = width;
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setDynamicSwatchWidths();
});

const originalHandleOptionConditions = handleOptionConditions;
handleOptionConditions = function() {
  originalHandleOptionConditions();
  setDynamicSwatchWidths();
};

const originalPreselectSingleOptionsValues = preselectSingleOptionsValues;
preselectSingleOptionsValues = function() {
  originalPreselectSingleOptionsValues();
  setTimeout(() => {
    setDynamicSwatchWidths();
  }, 100);
};
