const fs = require('fs');
const Transform = require('stream').Transform;
const Crawler = require("simplecrawler");
const stringify = require('csv-stringify');

const NoDataFoundError = require('./errors').NoDataFoundError;
const parser = require('./parser');
const createConfig = require('./config');
const log = console.log;

const createOutputStream = (filename) => {
  const writeStream = fs.createWriteStream(filename);
  const stringifyStream = stringify({ header: true });
  const pusher = new Transform({ objectMode: true })
  pusher.pipe(stringifyStream).pipe(writeStream);
  return pusher;
}

const start = () => {
  const config = createConfig();
  const pusher = createOutputStream(config.metadataCsvFile);
  const crawler = createCrawler(config, pusher);
  crawler.start();
  return crawler;
}

const createCrawler = (config, pusher) => {
  const crawler = new Crawler(config.catalogUrl);
  
  const isCatalog = function(queueItem) {
    return queueItem.url === config.catalogUrl;
  };
  
  const isCatalogPage = function(queueItem) {
    return queueItem.url.includes(decodeURIComponent(config.baseCatalogPageUrl).replace(' ', '+'));
  };
  
  const isDatasetXmlUrl = function(queueItem) {
    return queueItem.url.includes(config.datasetXmlUrl);
  };
  
  const isDatasetJsonUrl = function(queueItem) {
    return queueItem.url.includes(config.datasetJsonUrl);
  };
  
  const isDatasetUrl = function(queueItem) {
    return isDatasetJsonUrl(queueItem) || isDatasetXmlUrl(queueItem);
  };
  
  crawler.cache = new Crawler.cache('/data/cache');
  crawler.cache.datastore.saveCache = function () {
    // workaround for exit handler
    const backend = crawler.cache.datastore;
    fs.writeFileSync(backend.location + "cacheindex.json", JSON.stringify(backend.index));
  };
  
  crawler.interval = config.delay;
  crawler.maxConcurrency = config.concurrency;
  
  crawler.on('complete', () => {
    log('Crawler finished')
    pusher.end();
  });
  
  crawler.discoverResources = false;
  let pageQueue = [];
  let datasetsPending = {};
  
  crawler.on("fetchcomplete", function(queueItem, buffer) {
    log("%s (%d bytes)", queueItem.url, buffer.length);
    const response = buffer.toString("utf8");
    if(isCatalog(queueItem)) {
      const pagesCount = parser.pagesCount(response);
      const pages = Array.from({length: pagesCount}, (el, index) => index);
      pages.forEach(page => {
        pageQueue.push(config.baseCatalogPageUrl + page);
      });
    } else if(isCatalogPage(queueItem)) {
      log('catalog page');
      const datasetIds = parser.datasetIds(response);
      datasetIds.forEach(id => {
        const url = `${config.datasetJsonUrl}${id}`;
        datasetsPending[url] = id;
        crawler.queueURL(url);
      });
    } else if(isDatasetJsonUrl(queueItem)) {
      const dataset = JSON.parse(response);
      delete datasetsPending[queueItem.url];
      pusher.push(dataset);
    };
    if(Object.keys(datasetsPending).length === 0 && pageQueue.length !== 0) {
      crawler.queueURL(pageQueue.pop());
    }
  });

  crawler.on("fetcherror", function(queueItem, response) {
    console.log("ERROR for %s", decodeURI(queueItem.url));
    console.log("ERROR is %s", response.statusCode);
    const force = true;
    crawler.queueURL(queueItem.url, undefined, force);
  });
  
  crawler.addFetchCondition(function(queueItem, referrerQueueItem, callback) {
    let fetch = false;
    if(isCatalog(queueItem) || isCatalogPage(queueItem) || isDatasetUrl(queueItem)) {
      fetch = true;
    }
    callback(null, fetch);
  });

  return crawler;
};

let crawler;

module.exports = {
  bulk() {
    log('not implemented')
  },
  batch() {
    crawler = start();
  },
}
