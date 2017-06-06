const crawlNodes = require('./crawlNodes');

let lastKnownNode = 92807;
let firstKnownNode = 361;

//crawlNodes(lastKnownNode, firstKnownNode);

crawlNodes(1000, 361)
  .then(errors => console.log(errors))
  .catch(e => console.error('Errors:', e));
