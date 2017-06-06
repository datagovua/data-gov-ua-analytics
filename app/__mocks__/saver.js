module.exports = {
  init() {
  },
  save: jest.fn(),
  finish() {
    return new Promise(resolve => resolve());
  }
};
