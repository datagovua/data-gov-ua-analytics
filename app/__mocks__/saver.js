module.exports = {
  init() {
  },
  saveNode: jest.fn(),
  finish() {
    return new Promise(resolve => resolve());
  }
};
