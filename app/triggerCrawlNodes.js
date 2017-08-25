/**
 * Input:
 * - http fetch /datasets?sort_bef_combine=created%20DESC
 * - http cache (rethinkdb)
 * - http delay
 * Output:
 * - nodes rethinkdb table: node_id, canonical, revision_id, dataset_id
 */
const cheerio = require('cheerio');
const url = require('url');

const crawlNodes = require('./crawlNodes');
const createRequester = require('./requester');
const parser = require('./parser');

let lastKnownNode = 92807;
let firstKnownNode = 407; // 361
const testNodeId = 420;
const NODE_ENV = process.env.NODE_ENV.trim();
const IS_PRODUCTION = NODE_ENV === 'production';

const requester = createRequester();

function* interval(min, max) {
  let curr = max;

  while(curr >= min) {
    yield curr;
    curr--;
  }
}

function getMissing() {
  return fetchLastKnownId().then((nodeId) => {
    // TODO: open database, sort by id, get last
    // TODO: open database, get existing ids, find gaps
    let idArray = [...interval(firstKnownNode, nodeId)];
    if(!IS_PRODUCTION) {
      idArray.push(2801);
      idArray.push(7137);
    }
    return idArray;
  });
}

function fetchLastKnownId() {
  // get number of datasets
  // TODO fetch last dataset, get its node id if not known
  return requester.init().then(() => {
    const force = IS_PRODUCTION;
    return requester.request('/datasets?sort_bef_combine=created%20DESC', force)
      .then(parseDatasetId)
      .then(fetchByDatasetId)
      .then(parseNodeId);
  });
}

function parseDatasetId(pageContent) {
  return new Promise((resolve, reject) => {
    try {
      let dom = cheerio.load(pageContent);
      let datasetUrl = matches = dom('a').filter((_, el) => {
        let url = dom(el).attr('href');
        if(url) {
          let match = url.match(/^\/passport\/(.*)$/);
          return !!match;
        }
        return false;
      }).first().attr('href');
      let match = datasetUrl.match(/^\/passport\/(.*)$/);
      if(match) {
        resolve(match[1]);
      }
    } catch(e) {
      reject(e);
    }
  });
}

function fetchByDatasetId(datasetId) {
  return requester.request('/passport/' + datasetId);
}

function parseNodeId(datasetPageContent) {
  return new Promise((resolve, reject) => {
    try {
      let dom = cheerio.load(datasetPageContent);
      let nodeId = parser.parseNodeId(dom);
      resolve(IS_PRODUCTION ? nodeId : testNodeId);
    } catch(e) {
      reject(e);
    }
  });
}

module.exports = function () {
  return getMissing().then(nodeIds => {
    requester.finish();
    return crawlNodes(nodeIds);
  })
  .then(errors => {
    if(errors.length) {
      console.log("Permanent errors:")
    }
    errors.forEach(function(e) {
      if(e.statusCode !== undefined) {
        console.log(e.path, e.statusCode);
      } else {
        console.log(e);
      }
    });
  })
}
