class Cache {
  constructor(cacheLocation) {
  }

  init() {
    return new Promise(resolve => resolve());
  }

  save(url, content) {
    return new Promise(resolve => resolve(content));
  }

  retrieve(url) {
    return new Promise(resolve => resolve());
  }

  finish() {
    return new Promise(resolve => resolve());
  }
}

module.exports = Cache;
