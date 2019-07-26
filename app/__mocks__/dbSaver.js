module.exports = function() {
  return {
    init() {
      return new Promise(resolve => resolve());
    },
    saveNode: jest.fn(),
    finish() {
      return new Promise(resolve => resolve());
    }
  }
};
