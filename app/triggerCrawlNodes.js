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

const createSaver = require('./dbSaver')
const crawlNodes = require('./crawlNodes');
const createRequester = require('./requester');
const parser = require('./parser');

let lastKnownNode = 92807;
let firstKnownNode = 407; // 361
const testNodeId = 463;
const ONLY_NODES = process.env.ONLY_NODES && process.env.ONLY_NODES.split(',').map((i) => parseInt(i, 10));
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

async function findGaps(firstNodeId, lastNodeId) {
  // TODO: open database, sort by id, get last
  // TODO: open database, get existing ids, find gaps
  let idArray = [...interval(firstNodeId, lastNodeId)];
  return idArray;
}

async function getMissingNodes() {
  let idArray = [];
  if(ONLY_NODES) {
    return ONLY_NODES;
  }
  if(!IS_PRODUCTION) {
    // EDR = 6218
    // idArray.push(463);
    //idArray.push(2801);
    //idArray.push(7137);
    idArray.push(6218);
    return idArray;
  }
  const lastNodeId = await fetchLastKnownId();
  const firstNodeId = firstKnownNode;
  idArray = await findGaps(firstNodeId, lastNodeId);
  return idArray;
}

async function fetchLastKnownId() {
  // get number of datasets
  // TODO fetch last dataset, get its node id if not known
  const force = true;
  const datasetsPageContent = await requester.request('/datasets?sort_bef_combine=created%20DESC', force);
  const datasetId = await parseDatasetId(datasetsPageContent);
  const datasetPageContent = await fetchByDatasetId(datasetId);
  return await parseNodeId(datasetPageContent);
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
      resolve(nodeId);
    } catch(e) {
      reject(e);
    }
  });
}

let dbSaver;

module.exports = async function () {
  dbSaver = createSaver();
  await requester.init();
  const nodeIds = await getMissingNodes();
  requester.finish();
  const errors = await crawlNodes(dbSaver, nodeIds);
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
}
