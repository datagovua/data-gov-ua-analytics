const cheerio = require('cheerio');
const Promise = require('bluebird')

const requester = require('./requester');
const saver = require('./saver');

function visited(nodeId) {
  return false;
}

function parseLink(dom, name) {
  return dom('link').filter((_, el) => {
    return dom(el).attr('rel') === name;
  }).attr('href');
}

function parseShort(dom) {
  return parseLink(dom, 'shortlink');
}

function parseCanonical(dom) {
  return parseLink(dom, 'canonical');
}

function parseDatasetId(dom) {
  let url = parseCanonical(dom);
  let match = url.match(/^http:\/\/(?:.*)\/passport\/(.*)$/)
  return match ? match[1] : null;
}

function parseNodeId(dom) {
  let url = parseShort(dom);
  let match = url.match(/^http:\/\/(?:.*)\/node\/(.*)$/)
  return match ? parseInt(match[1]) : null;
}

function parseRevisionId(dom) {
  return parseInt(dom('a').filter((_, el) => {
    let aTitle = 'Вставити цей замінник у вашу форму';
    return dom(el).attr('title') === aTitle;
  }).text());
}

module.exports = function crawlNodes(lastNodeId, firstNodeId) {

  let errors = [];
  saver.init();
  return requester.init().then(() => {

    return new Promise((resolve, reject) => {

      function scheduleNext(nodeId) {
        let nextNodeId = nodeId - 1;
        if(nextNodeId < firstNodeId) {
          saver.finish()
            .then(() => requester.finish())
            .then(() => resolve(errors));
        } else if(visited(nextNodeId)) {
          process.nextTick(() => scheduleNext(nextNodeId - 1));
        } else {
          process.nextTick(() => getNode(nextNodeId))
        }
      }
      
      function getNode(nodeId) {
        requester.request(`/node/${nodeId}`)
          .then(res => cheerio.load(res))
          .then(dom => ({
            node_id: parseNodeId(dom),
            canonical: parseCanonical(dom),
            revision_id: parseRevisionId(dom),
            dataset_id: parseDatasetId(dom),
          }))
          .then(node => saver.save(node))
          .then(() => {
            scheduleNext(nodeId);
          })
          .catch(e => {
            errors.push(e);
            scheduleNext(nodeId);
          });
      }

      scheduleNext(lastNodeId + 1);
    })
  });

}
