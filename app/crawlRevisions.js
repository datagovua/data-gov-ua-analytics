/**
 * Input: nodes rethinkdb table: node_id, dataset_id
 * Output: revisions.csv: (revision_id, date, node_id, dataset_id)
 */
const cheerio = require('cheerio');
const Promise = require('bluebird')

const createRequester = require('./requester');
const createSaver = require('./dbSaver');
const parser = require('./parser');

const requester = createRequester();

const ONLY_NODES = process.env.ONLY_NODES && process.env.ONLY_NODES.split(',').map((i) => parseInt(i, 10));

let saver;

function visited(node) {
  return false;
}

function flatten(array) {
  return array.reduce((a, b) => a.concat(b), []);
}

function parseUrl(url) {
  let matchPassport = url.match(/^\/passport\/(.*?)\/version\/(\d+)$/);
  if(matchPassport) {
    return { dataset_id: matchPassport[1], revision_id: matchPassport[2] }
  } else {
    let matchNode = url.match(/^\/node\/(.*?)\/revisions\/(\d+)\/view$/);
    if(matchNode) {
      return { node_id: matchNode[1], revision_id: matchNode[2] }
    }
  }
  throw "can't parse " + url;
}

function parseDate(text) {
  const dateMatch = text.match(/^версія від (\d\d)\.(\d\d)\.(\d\d\d\d)$/);
  if(dateMatch) {
    [_, day, month, year] = dateMatch;
    return year + '-' + month + '-' + day;
  }
}

function parseRevisions(dom, node) {
  // TODO add a parameter whether should fetch all or only new revisions
//  const last_revision_id = node.revision_id;
  const revisions = dom('.field-content a').map((i, el) => {
    let parsed = parseUrl(dom(el).attr('href'))
    let text = dom(el).text();
    let date = parseDate(text);
    return { revision_id: parseInt(parsed.revision_id), date, node_id: parseInt(node.node_id), dataset_id: node.dataset_id };
  }).get();
  const hasNext = !!dom('.pager-next a').attr('href');
  return { revisions: revisions, hasNext: hasNext };
}

async function getRevisionsPage(node, page) {
  const force = !!ONLY_NODES;
  const res = await requester.request(`/views/ajax?view_name=revision_dataset_views&view_args=${node.node_id}&view_display_id=block_2&page=${page}`, force);
  const json = JSON.parse(res);
  const dom = cheerio.load(json[1].data);
  const revisions = parseRevisions(dom, node);
  return revisions;
}

function getRevisions(node) {
  let nextExists = true;
  let currentPage = 0;
  let allRevisions = [];
  function getCurrentPage() {
    return getRevisionsPage(node, currentPage)
    .then((pageRevisions) => {
      allRevisions.push(pageRevisions.revisions);
      currentPage++;
      if(pageRevisions.hasNext) {
        return getCurrentPage();
      } else {
        return flatten(allRevisions);
      }
    });
  }
  return getCurrentPage();
}

module.exports = function crawlRevisions(itemArray) {
  let errors = [];
  saver = createSaver();
  return saver.init()
  .then(() => requester.init())
  .then(() => {
    return new Promise((resolve, reject) => {
      function scheduleNext(itemArray) {
        let item = itemArray.shift();
        if(!item) {
          saver.finish()
            .then(() => requester.finish())
            .then(() => {
              // TODO save errors
              if(errors.length) {
                console.log("Permanent errors:")
              }
              errors.forEach(function(e) {
                if(e.statusCode !== undefined) {
                  console.log(e.path, e.statusCode);
                } else {
                  if(e.path) {
                    console.log(e.path)
                  } else {
                    console.log(e);
                  }
                }
              });
              resolve();
            });
        } else if(visited(item)) {
          process.nextTick(() => scheduleNext(itemArray));
        } else {
          process.nextTick(() => {
            return getRevisions(item)
              .then(revisions => saver.saveTempRevisions(revisions))
              .then(() => {
                scheduleNext(itemArray);
              })
              .catch(e => {
                errors.push(e);
                scheduleNext(itemArray);
              })
          });
        }
      }
      scheduleNext(itemArray);
    });
  });
}
