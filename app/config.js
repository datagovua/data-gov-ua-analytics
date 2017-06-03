const rpErrors = require('request-promise/errors');
const NoDataFoundError = require('./errors').NoDataFoundError;


const createConfig = () => ({
  structuredFormats: ['json', 'xml', 'csv', 'xls', 'xlsx', 'yaml'],
  catalogUrl: 'http://data.gov.ua/datasets',
  baseCatalogPageUrl: 'http://data.gov.ua/datasets?field_organization_value=&title=&sort_bef_combine=created%20DESC&sort_order=DESC&sort_by=created&page=',
  datasetXmlUrl: 'http://data.gov.ua/view-dataset/dataset.xml?dataset-id=',
  datasetJsonUrl: 'http://data.gov.ua/view-dataset/dataset.json?dataset-id=',
  metadataFile: `../data/metadata-${new Date().toISOString()}.json`,
  metadataCsvFile: `../data/metadata-${new Date().toISOString()}.csv`,
  retryOptions: {
    max_tries: 480,
    interval: parseInt(process.env.DELAY) || 10000,
    max_interval: parseInt(process.env.DELAY) || 15 * 60 * 1000, // 15 mins
    backoff: 2,
    predicate: e => e instanceof rpErrors.RequestError
      || e instanceof rpErrors.StatusCodeError
      || e instanceof NoDataFoundError,
  },
  delay: parseInt(process.env.DELAY) || 10000,
  concurrency: parseInt(process.env.CONCURRENCY) || 1,
  catalogPageRequestQueue: {
    concurrency: parseInt(process.env.CONCURRENCY) || 1,
    delay: {
      max: parseInt(process.env.DELAY) || 15000,
      min: parseInt(process.env.DELAY) || 10000,
    },
  },
  metadataRequestQueue: {
    concurrency: parseInt(process.env.CONCURRENCY) || 1,
    delay: {
      max: parseInt(process.env.DELAY) || 15000,
      min: parseInt(process.env.DELAY) || 10000,
    },
  },
});
module.exports = createConfig;
