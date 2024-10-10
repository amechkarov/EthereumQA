const { expect } = require("chai");
/**
 * Assert product properties.
 * @param {Object} product
 * @param {string} expectedName
 * @param {number} expectedQuantity
 */
function assertProduct(product, expectedName, expectedQuantity) {
    expect(product.name).to.equal(expectedName);
    expect(product.quantity).to.equal(expectedQuantity);
}

module.exports = assertProduct;