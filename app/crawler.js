const request = require('request-promise');
const rpErrors = require('request-promise/errors');
const NoDataFoundError = require('./errors').NoDataFoundError;
const Promise = require('bluebird');
const cheerio = require('cheerio');
const retry = require('bluebird-retry');
const fs = require('fs-bluebird');

const config = {
  structuredFormats: ['json', 'xml', 'csv', 'xls', 'xlsx', 'yaml'],
  catalogUrl: 'http://data.gov.ua/datasets',
  baseCatalogPageUrl: 'http://data.gov.ua/datasets?field_organization_value=&title=&sort_bef_combine=created%20DESC&sort_order=DESC&sort_by=created&page=',
  datasetsCountElement: '.view-category-dataset-views .field-content .field-content',
  datasetLinkElement: '.views-field-field-big-title a',
  metadataFile: `../data/metadata-${new Date().toISOString()}.json`,
  retryOptions: {
    max_tries: 480,
    interval: 10 * 1000, // 10 seconds
    max_interval: 15 * 60 * 1000, // 15 mins
    backoff: 2,
    predicate: e => e instanceof rpErrors.RequestError
      || e instanceof rpErrors.StatusCodeError
      || e instanceof NoDataFoundError,
  },
  catalogPageRequestQueue: {
    concurrency: 1,
    delay: {
      max: 15000,
      min: 10000,
    },
  },
  metadataRequestQueue: {
    concurrency: 1,
    delay: {
      max: 15000,
      min: 10000,
    },
  },
};

const log = console.log;

const tryRequestPagesCount = function tryRequestPagesCount() {
  return request(config.catalogUrl).then((res) => {
    const $ = cheerio.load(res);
    const datasetCatalogElements = $(config.datasetsCountElement).toArray();
    const datasetsCount = datasetCatalogElements.reduce((prev, elem) =>
      prev + parseInt($(elem).text(), 10)
    , 0);

    if (!datasetsCount) {
      throw new NoDataFoundError('No datasets count information found on main page');
    }

    const pagesCount = Math.floor(datasetsCount / 10);

    log('Datasets count', datasetsCount);
    log('Pages count', pagesCount);

    return pagesCount;
  });
};

const requestPagesCount = function requestPagesCount() {
  log('Requesting data.gov.ua main page');
  return retry(tryRequestPagesCount, config.retryOptions);
};

const tryRequestPageDatasets = function tryRequestPageDatasets(i) {
  return request(config.baseCatalogPageUrl + i).then((page) => {
    const $ = cheerio.load(page);
    const datasets = $(config.datasetLinkElement).toArray().map((elem) => {
      const link = $(elem).attr('href');
      const id = link.substr(link.lastIndexOf('/') + 1);
      return { id, view: `http://data.gov.ua/view-dataset/dataset.json?dataset-id=${id}` };
    });

    if (!datasets.length) {
      throw new NoDataFoundError('No datasets found on catalog page');
    }

    return datasets;
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
    const page = i + 1;
    log(`Processing page ${page} of ${pagesCount} (not in order).`);

    const tryRequestPageDatasetsI = tryRequestPageDatasets.bind(null, page);
    return Promise.delay(randomDelay())
      .then(() => retry(tryRequestPageDatasetsI, config.retryOptions))
      .then(onPageDone);
  }, { concurrency: options.concurrency });
};

const flattenDatasets = function flattenDatasets(prev, cur) {
  return prev.concat(cur);
};

const logDatasets = function logDatasets(datasets) {
  log('Found', datasets.length, 'datasets');
  return datasets;
};

const handleMetadataError = function handleMetadataError(datasetId, err) {
  let message = err.toString();
  if (err.statusCode === 500 && err.response && err.response.statusMessage) {
    message = new Buffer(err.response.statusMessage, 'ascii').toString('utf-8');
  }
  console.error(message);
  return { dataset_id: datasetId, statusCode: err.statusCode, error: message };
};

const requestSingleMetadata = function requestSingleMetadata(dataset) {
  log(dataset.view);
  return request({
    uri: dataset.view,
    json: true,
  }).catch({ statusCode: 500 }, handleMetadataError.bind(null, dataset.id))
    .catch({ statusCode: 404 }, handleMetadataError.bind(null, dataset.id))
    .catch({ statusCode: 403 }, handleMetadataError.bind(null, dataset.id));
};

const requestMultipleMetadata = function requestMultipleMetadata(datasets) {
  const options = config.metadataRequestQueue;
  const randomDelay = randomRange.bind(null, options.delay.min, options.delay.max);
  return Promise.map(datasets, dataset =>
    Promise.delay(randomDelay())
      .then(() => retry(requestSingleMetadata.bind(null, dataset), config.retryOptions))
  , { concurrency: options.concurrency });
};

const appendToFile = function appendToFile(datasets) {
  const promise = fs.appendFileAsync(config.metadataFile, `\n${JSON.stringify(datasets)}`, 'utf8');
  log('Metadata appended to', config.metadataFile);
  return promise;
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
    .then(pagesCount =>
      requestDatasetsByPage(pagesCount, datasets =>
        Promise.resolve(logDatasets(datasets))
          .then(requestMultipleMetadata)
          .then(appendToFile))),
};

module.exports = strategies;
