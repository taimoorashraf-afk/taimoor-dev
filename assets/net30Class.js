class Net30Cart extends HTMLElement{
    constructor() {
        super();
        this.credits = 0;
        
        this.payNowOnly = true;
        this.net30Wrapper = this.querySelector('.net-30-wrapper');
        this.customerId = this.net30Wrapper?.getAttribute('customerId');
        this.cartTotal = this.net30Wrapper?.getAttribute('cartTotal');
        this.totalCreditsElement = this.net30Wrapper?.querySelector('.available-credits');
    }

    connectedCallback() {
        this.getCredits()
    }

    disconnectedCallback(){}

    async getCredits(){
        
        const customerId = `gid://shopify/Customer/${this.customerId}`
        const cartTotalAmount = 100
        const requestOptions = {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "customer_id": customerId,
                "cart_amount": cartTotalAmount
            })
        };
        
        const response = await fetch(buildApiUrl('api/report/get-report-v2', requestOptions));
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        
        this.updateData(data)
    }

    updateData(data){
        if(data.creditAmount){
            this.credits = data?.creditAmount
            this.payNowOnly = data?.payNowOnly ?? true
            if(data.payNowOnly != 'true'){
                this.updateContect()
            }
        }
    }
    updateContect(){
        this.classList.remove('hidden')
        if(this.totalCreditsElement){
            this.totalCreditsElement.textContent = `${ this.formatCurrency(this.credits) }`;
        }
    }

    formatCurrency(amount) {
        if (isNaN(amount)) return 
        // Convert the number to a string with commas as thousand separators
        return amount.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        });
    }
}

customElements.define('net-30-cart-component', Net30Cart);
<script src="{{ 'api-domain-config.js' | asset_url }}"></script>