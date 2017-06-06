let request = require('request-promise');
const retry = require('bluebird-retry');
const rpErrors = require('request-promise/errors');
const http = require('http');
const HttpProxyAgent = require('http-proxy-agent');
const Cache = require('./cache');

const proxy = process.env.PROXY_URL;
if(proxy) {
  request = request.defaults({'proxy': proxy})
}
const domain = 'http://data.gov.ua';

let retryOptions;
let cacheLocation;
let cache;

module.exports = {
  init(delay, cacheLocation) {
    cache = new Cache(cacheLocation || '/data/cache2/');
    retryOptions = {
      max_tries: 30,
      interval: delay || parseInt(process.env.DELAY) || 10000,
      max_interval: delay || parseInt(process.env.DELAY) || 15 * 60 * 1000, // 15 mins
      backoff: 2,
      predicate: e => e instanceof rpErrors.RequestError
        || (e instanceof rpErrors.StatusCodeError && e.statusCode !== 404),
    };
    return cache.init();
  },

  request(path) {
    return cache.retrieve(path).then((content) => {
      if(content) {
        console.log(path + ' from cache');
        return content;
      } else {
        return retry(() => { return request(domain + path) }, retryOptions).then((content) => {
            return cache.save(path, content);
          });
      }
    });
  },
  finish() {
    return cache.finish();
  }
};
