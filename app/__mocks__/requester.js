let urlResolveReject = (url, resolve, reject) => resolve();

const request = function request(url) {
  return new Promise((resolve, reject) => {
    urlResolveReject(url, resolve, reject);
  });
};

module.exports = function() {
  return {
    mockSetUp(mock) {
      urlResolveReject = mock;
    },
    init() {
      return new Promise(resolve => resolve());
    },
    request,
    finish() {
      urlResolveReject = (url, resolve, reject) => resolve();
      return new Promise(resolve => resolve())
    }
  };
}
