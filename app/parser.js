const cheerio = require('cheerio');

const NoDataFoundError = require('./errors').NoDataFoundError;

const log = console.log;
const datasetsCountElement = '.view-category-dataset-views .field-content .field-content';
const datasetLinkElement = '.views-field-field-big-title a';

const pagesCount = function (response) {
  const $ = cheerio.load(response);
  const datasetCatalogElements = $(datasetsCountElement).toArray();
  const datasetsCount = datasetCatalogElements.reduce((prev, elem) =>
    prev + parseInt($(elem).text(), 10)
  , 0);

  if (!datasetsCount) {
    throw new NoDataFoundError('No datasets count information found on main page');
  }

  const pagesCount = Math.floor(datasetsCount / 10) + (datasetsCount % 10 ? 1 : 0);

  log('Datasets count', datasetsCount);
  log('Pages count', pagesCount);

  return pagesCount;
};

const datasetIds = function (page) {
  const $ = cheerio.load(page);
  const datasetIds = $(datasetLinkElement).toArray().map((elem) => {
    const link = $(elem).attr('href');
    const id = link.substr(link.lastIndexOf('/') + 1);
    return id;
  });

  if (!datasetIds.length) {
    throw new NoDataFoundError('No datasets found on catalog page');
  }

  return datasetIds;
};

module.exports = {
  pagesCount,
  datasetIds,
}
