/**
 * Input:
 * - 'files' table records with 'create' field missing
 * - 'resource_nodes' table: ('resource_node_id', 'file_url')
 * - 'files' and 'resource_nodes' joined by 'file_url'
 * - external url http://old.data.gov.ua/view-dataset/dataset-file/$resource_node_id
 * Output:
 * - files table with 'create' field filled
 */
const createDbReader = require('./dbReader');
const createDbSaver = require('./dbSaver');
const createRequester = require('./requester');


function fetchDatasetFile(requester, node_id) {
  return requester.request(`/view-dataset/dataset-file/${node_id}.json`)
  .then(res => JSON.parse(res))
  .catch(err => null);
}

module.exports = async function() {
  const reader = createDbReader();
  const saver = createDbSaver();
  const requester = createRequester();

  function readFilesWithoutCreated() {
    return reader.readFilesWithoutCreated();
  }

  function writeFileCreated(file, revision_id) {
    return saver.saveFile(file, revision_id);
  }

  await reader.init();
  await saver.init();
  await requester.init();
  const filesCursor = await readFilesWithoutCreated();
  await filesCursor.eachAsync(async (fileMetadata) => {
    const { revision_id } = fileMetadata;
    if(!fileMetadata.node_id) {
       throw new Error('file doesn\'t have a node id: ' + JSON.stringify(fileMetadata));
    }
    const file = await fetchDatasetFile(requester, fileMetadata.node_id);
    if(!file) {
      console.log('error fetching file ' + fileMetadata.node_id);
      return;
    }
    await writeFileCreated(file, revision_id);
  });
  await reader.finish();
  await saver.finish();
  await requester.finish();
}

