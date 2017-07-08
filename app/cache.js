const mkdirp = require('mkdirp');
const storage = require('node-persist');

class Cache {
  constructor(cacheLocation) {
    this.cacheLocation = cacheLocation;
  }

  init() {
    return new Promise((resolve, reject) => {
      resolve(storage.init({
        dir: this.cacheLocation,
      }));
    });
  }

  save(url, content) {
    return storage.setItem(url, content)
           .then(() => storage.getItem(url));
  }

  retrieve(url) {
    return storage.getItem(url);
  }

  finish() {
    return new Promise(resolve => resolve());
  }
}

module.exports = Cache;
