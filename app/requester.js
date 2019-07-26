let request = require('request-promise');
const retry = require('bluebird-retry');
const rpErrors = require('request-promise/errors');
const http = require('http');
const HttpProxyAgent = require('http-proxy-agent');
const Cache = require('./cache');

const proxy = process.env.PROXY_URL;
const DELAY = parseInt(process.env.DELAY);
if(proxy) {
  request = request.defaults({'proxy': proxy})
}
const domain = 'http://old.data.gov.ua';

module.exports = function() {
  return new Requester();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Requester {

  constructor() {
  }

  init(delayMs, cacheLocation) {
    this.delayMs = delayMs || DELAY;
    this.cache = new Cache();
    this.retryOptions = {
      throw_original: true,
      max_tries: 7,
      interval: delayMs || parseInt(process.env.DELAY) || 10000,
      max_interval: delayMs || parseInt(process.env.DELAY) || 15 * 60 * 1000, // 15 mins
      backoff: 2,
      predicate: e => e instanceof rpErrors.RequestError
        || (e instanceof rpErrors.StatusCodeError &&
            e.statusCode !== 404 && e.statusCode !== 403),
    };
    return this.cache.init();
  }

  requestLive(path) {
    if(!path) throw 'Path should be string';
    console.log(domain + path + ' live');
    return delay(this.delayMs).then(() => {
      return retry(() => { return request(domain + path); }, this.retryOptions)
    })
    .then((content) => {
      return this.cache.save(path, { content, statusCode: 200 })
      .then(() => {
        return content;
      });
    })
    .catch(e => {
      if(!e.response) throw e;
      return this.cache.save(path, {
        content: e.response.body,
        statusCode: e.response.statusCode,
      })
      .then(() => {
        throw { path, content: e.response.body, statusCode: e.response.statusCode };
      });
    });
  }

  async request(path, force) {
    if(force) {
      return this.requestLive(path);
    }
    return this.cache.retrieve(path).then((response) => {
      if(response) {
        console.log(path + ' from cache');
        if(response.statusCode === 200) {
          return response.content;
        } else {
          throw {
            path,
            content: response.content,
            statusCode: response.statusCode,
          };
        }
      } else {
        return this.requestLive(path)
      }
    });
  }

  finish() {
    return this.cache.finish();
  }
};
