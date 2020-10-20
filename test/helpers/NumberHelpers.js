function toBN(num, decimals = 18) {
  return num + '0'.repeat(decimals);
}

module.exports = {
  toBN,
};