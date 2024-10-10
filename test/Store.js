const { expect } = require("chai");
const { ethers } = require("hardhat");
const assertProduct = require('./assertions/StoreAssertions.js');


describe("Store Contract", function () {
    let store;
    let owner;
    let client1;
    let name = "Product A";
    let quantity = 10;

    beforeEach(async function () {
        const StoreFactory = await ethers.getContractFactory("Store"); // Get the ContractFactory for Store
        [owner, client1] = await ethers.getSigners(); // Get the owner and another address

        // Deploy the contract and get the contract instance
        store = await StoreFactory.deploy();
    });


    describe("addProduct", function () {
        it("Should add a product and emit event", async function () {

            await expect(store.addProduct(name, quantity))
            .to.emit(store,"ProductAdded")
            .withArgs(0,name,quantity);

            const product = await store.getProductById(0);
            assertProduct(product, name, quantity);
        });


        it("Should not add the same product twice, just update quantity", async function () {
            await store.addProduct(name,quantity);
            const newQuantity = 17;

            await expect(store.addProduct(name,newQuantity))
            .to.emit(store,"ProductUpdated")
            .withArgs(0,name,newQuantity);
            
            const newProduct = await store.products(0);
            assertProduct(newProduct, name, newQuantity);

        });

        it("Should check quantity and name conditions", async function () {
            const invalidName = "";
            const validName = "Valid Product";
            const validQuantity = 5;


            await expect(store.addProduct(invalidName, validQuantity))
            .to.be.revertedWith("You have to enter a name!");

            await expect(store.addProduct(validName, 0))
            .to.be.revertedWith("Quantity can't be 0!");
        });

        it("Should not add product if not owner", async function () {
            await store.addProduct(name, quantity);

            const newStore = await store.connect(client1);

            await expect(newStore.addProduct(name,quantity))
            .to.be.revertedWithCustomError(store, "OwnableUnauthorizedAccount")
            .withArgs(client1.address); 
        });

    });

    describe("getProductById", function () {
        it("Should return a product by id", async function () {
            await store.addProduct(name, quantity);

            const product = await store.getProductById(0);

            assertProduct(product, name, quantity);
        });

        it("Should not return product if it doesn't exist", async function() {
            const invalidId = 1; 

             await expect(store.getProductById(invalidId))
             .to.be.revertedWith("This product does not exist!");
        });
    });

    describe("getProductByName", function () {
        it("Should return product by name", async function () {
            await store.addProduct(name, quantity);

            const product = await store.getProductByName(name);

            assertProduct(product, name, quantity);
        });

        it("Should not return product by name if it doesn't exist", async function () {            

            await expect(store.getProductByName(name))
            .to.be.revertedWith("This product does not exist!");
        });

        it("Should not return product if the name is invalid", async function() {
            const invalidId = ""; 
            
             await expect(store.getProductByName(invalidId))
            .to.be.revertedWith("You have to enter a name!");
        });
    });


    describe("getAllProducts", function () {
        it("Should return all products", async function () {
            await store.addProduct(name, quantity);

            const products = await store.getAllProducts();
            const product = await store.getProductById(0);

            expect(products).to.deep.include(product);
        });
    });

    describe("getProductBuyersById", function () {
        it("Should return all buyers of the product", async function () {
            await store.addProduct(name, quantity);

            await store.buyProduct(0);

            const buyers = await store.getProductBuyersById(0);

            expect(buyers).to.deep.include(owner.address);
        });

        it("Should not return product buyers if the product doesn't exist", async function() {
            const invalidId = 1; 
            
             await expect(store.getProductBuyersById(invalidId))
            .to.be.revertedWith("This product does not exist!");
        });
    });

    describe("updateProduct", function () {
        it("Should update an existing product and emit event", async function () {
            await store.addProduct(name, quantity);

            const newQuantity = 20;

            await expect(store.updateProductQuantity(0,newQuantity))
            .to.emit(store,"ProductUpdated")
            .withArgs(0,name,newQuantity)

            const product = await store.getProductById(0);
            assertProduct(product, name, newQuantity);

        });

        it("Should not update product if not owner", async function () {
            await store.addProduct(name, quantity);

            const newStore = await store.connect(client1);

            await expect(newStore.updateProductQuantity(0, quantity))
            .to.be.revertedWithCustomError(store, "OwnableUnauthorizedAccount")
            .withArgs(client1.address); 
        });

        it("Should not update product if it doesn't exist", async function() {

            const invalidId = 1;
            await expect(store.updateProductQuantity(invalidId, 50))
            .to.be.revertedWith("This product does not exist!");
        });
    });

    describe("buyProduct", function() {
        let newStoe;

        beforeEach(async function () {
            await store.addProduct(name,quantity);
            newStore = await store.connect(client1);
        });

        it("Should buy a product", async function() {
            
            await expect(newStore.buyProduct(0))
            .to.emit(store,"ProductBought")
            .withArgs(0,client1.address)

            const buyers = await newStore.getProductBuyersById(0);
            const product = await newStore.getProductById(0);

            expect(buyers)
           .to.contain(client1.address);

            expect(product.quantity).to.equal(quantity-1);
        });

        it("Should not buy a product if quantity is 0", async function() {
            await store.updateProductQuantity(0,0);

            await expect(newStore.buyProduct(0))
            .to.be.revertedWith("Quantity can't be 0!");
        });

        it("Should buy a product if quantity is enough after a refund", async function() {
            await store.updateProductQuantity(0,1);
            await newStore.buyProduct(0);
            await newStore.refundProduct(0);

            const product = await newStore.getProductById(0);

            expect(product.quantity).to.equal(1);
        });

        it("Should not buy the same product more than once", async function() {

            await newStore.buyProduct(0);
            let product = await newStore.getProductById(0);
             

            await expect(newStore.buyProduct(0))
            .to.be.revertedWith("You cannot buy the same product more than once!");

            expect(product.quantity).not.to.equal(quantity-2);
        });

        it("Should not buy product if it doesn't exist", async function() {
            const invalidId = 1; 
            
             await expect(store.buyProduct(invalidId))
            .to.be.revertedWith("This product does not exist!");
        });
    });

    describe("refundProduct", function() {
        let newStoe;
        beforeEach(async function () {
            await store.addProduct(name,quantity);
            newStore = await store.connect(client1);
        });

        it("Should emit event on refunding products", async function() {    
        
            await newStore.buyProduct(0);

            await expect(newStore.refundProduct(0))
            .to.emit(store,"ProductRefund")
            .withArgs(0)
        });

    
        it("Should not retfund if buyer has no products", async function() {      

            await expect(newStore.refundProduct(0))
            .to.be.revertedWith("You've already returned your product or didn't even bought it.");
        });

        it("Should not retfund if buyer has already returned his product", async function() {

            await newStore.buyProduct(0);

            await newStore.refundProduct(0);
            
            await expect(newStore.refundProduct(0))
            .to.be.revertedWith("You've already returned your product or didn't even bought it.");
        });


        it("Should not refund the product if 100 blocks have passed ", async function() {
            await newStore.buyProduct(0);
    
            await ethers.provider.send("hardhat_mine", ["0x65"]); //hexademical value for 100
            
            
            await expect(newStore.refundProduct(0))
            .to.be.revertedWith("Sorry, your request for refund has been denied.");
        });

        it("Should not refund product if it doesn't exist", async function() {
            const invalidId = 1; 

             await expect(store.refundProduct(invalidId))
            .to.be.revertedWith("This product does not exist!");
        });
    });

    describe("setRefundPolicyNumber", function () {
        let newStoe;
        beforeEach(async function () {
            await store.addProduct(name,quantity);
            newStore = await store.connect(client1);
        });

        it("Should set new refund policy", async function() {

            await store.setRefundPolicyNumber(0);
            const refundPolicyNumber = await store.getRefundPolicyNumber();

            expect(refundPolicyNumber).to.equal(0);
        });
        it("Should change refund policy if not owner", async function () {
            await newStore.buyProduct(0);

            await expect(newStore.setRefundPolicyNumber(0))
            .to.be.revertedWithCustomError(newStore, "OwnableUnauthorizedAccount")
            .withArgs(client1.address); 
        });

    })
});