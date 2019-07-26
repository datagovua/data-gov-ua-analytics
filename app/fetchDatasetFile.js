const createRequester = require('./requester');

const requester = createRequester();


function fetchFile(resource_node_id) {
  return requester.request(`/view-dataset/dataset-file/${resource_node_id}`)
  .then(res => JSON.parse(res));
}

module.exports = function fetchDatasetFile(resource_node_id) {
  return requester.init().then(() => {
    return fetchFile(resource_node_id);
  }).then();
}
