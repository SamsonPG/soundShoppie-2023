function calculateTotal(products) {
  let total = 0;
  products.forEach((item) => {
    const productPrice =
      item.finalprice > 0 ? item.finalprice : item.product.price;
    const quantity = item.quantity;
    const itemTotal = productPrice * quantity;
    total += itemTotal || 0; // Add 0 if itemTotal is NaN or undefined
  });
  return parseFloat(total.toFixed(2));
}

module.exports = { calculateTotal };
