const request = require('request-promise');
const rpErrors = require('request-promise/errors');
const Promise = require('bluebird');
const cheerio = require('cheerio');
const retry = require('bluebird-retry');
const fs = require('fs-bluebird');
const xml2json = require('xml2json');

const parser = require('./parser');
const parsePagesCount = parser.pagesCount;
const parseDatasetIds = parser.datasetIds;

const createConfig = require('./config');
const createOutputStream = require('./pusher');
const NoDataFoundError = require('./errors').NoDataFoundError;


let config;

const log = console.log;

const tryRequestPagesCount = function tryRequestPagesCount() {
  return request(config.catalogUrl).then((res) => {
    return parsePagesCount(res);
  });
};

const requestPagesCount = function requestPagesCount() {
  log('Requesting data.gov.ua main page');
  config = createConfig();
  return retry(tryRequestPagesCount, config.retryOptions);
};

const tryRequestPageDatasets = function tryRequestPageDatasets(i) {
  return request(config.baseCatalogPageUrl + i).then((page) => {
    return parseDatasetIds(page);
  });
};

const randomRange = function randomRange(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};

const requestDatasetsByPage = function requestDatasetsByPage(pagesCount, onPageDone = (_ => _)) {
  const pageNumbers = Array.from(Array(pagesCount).keys());
  const options = config.catalogPageRequestQueue;
  const randomDelay = randomRange.bind(null, options.delay.min, options.delay.max);
  return Promise.map(pageNumbers, (i) => {
    const page = i;
    log(`Processing page ${page + 1} of ${pagesCount} (not in order).`);

    const tryRequestPageDatasetsI = tryRequestPageDatasets.bind(null, page);
    return Promise.delay(randomDelay())
      .then(() => retry(tryRequestPageDatasetsI, config.retryOptions))
      .then(onPageDone)
      .catch(error => handleCatalogPageError(page, error));
  }, { concurrency: 1 });
};

const flattenDatasets = function flattenDatasets(prev, cur) {
  return prev.concat(cur);
};

const logDatasets = function logDatasets(datasets) {
  log('Found', datasets.length, 'datasets');
  return datasets;
};

const handleCatalogPageError = function handleCatalogPageError(page, error) {
  log('Catalog page ' + page + ' failed: ' + error.message);
};

const handleMetadataError = function handleMetadataError(datasetId, err) {
  let message = err.toString();
  if (err.statusCode === 500 && err.response && err.response.statusMessage) {
    message = new Buffer(err.response.statusMessage, 'ascii').toString('utf-8');
  }
  console.error(message);
  return { dataset_id: datasetId, statusCode: err.statusCode, error: message };
};

const requestSingleMetadata = function requestSingleMetadata(datasetId) {
  const url = config.datasetXmlUrl + datasetId;
  log(url);
  return request({
    uri: url,
    transform: body => xml2json.toJson(body, { object: true }).result,
  }).catch({ statusCode: 500 }, handleMetadataError.bind(null, datasetId))
    .catch({ statusCode: 404 }, handleMetadataError.bind(null, datasetId))
    .catch(rpErrors.TransformError, handleMetadataError.bind(null, datasetId));
};

const requestMultipleMetadata = function requestMultipleMetadata(datasets) {
  const options = config.metadataRequestQueue;
  const randomDelay = randomRange.bind(null, options.delay.min, options.delay.max);
  return Promise.map(datasets, dataset =>
    Promise.delay(randomDelay())
      .then(() => retry(requestSingleMetadata.bind(null, dataset), config.retryOptions))
  , { concurrency: options.concurrency });
};

let pusher;

const appendToFile = function appendToFile(datasets) {
  if(!pusher) {
    pusher = createOutputStream(config.metadataCsvFile);
  }
  datasets.forEach(dataset => pusher.push(dataset));
  log('Appending to', config.metadataCsvFile);
  return new Promise(resolve => resolve());
};

const writeToFile = function writeToFile(datasets) {
  const promise = fs.writeFileAsync(config.metadataFile, JSON.stringify(datasets), 'utf8');
  log('Metadata saved to', config.metadataFile);
  return promise;
};

const strategies = {
  // TODO Add an ability to pass options
  bulk: () => requestPagesCount()
    .then(requestDatasetsByPage)
    .reduce(flattenDatasets)
    .then(logDatasets)
    .then(requestMultipleMetadata)
    .then(writeToFile),

  // TODO Add an ability to pass options
  batch: () => requestPagesCount()
    .then(pagesCount => {
      return requestDatasetsByPage(pagesCount, datasets => {
        return Promise.resolve(logDatasets(datasets))
          .then(requestMultipleMetadata)
          .then(appendToFile)
      });
    }).then(() => pusher && pusher.end()),
};

module.exports = strategies;
