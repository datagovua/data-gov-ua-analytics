/**
 * Input:
 * - datasets, revisions, files tables
 * - dataset_node_ids
 * - filename
 * Output:
 * - metadata.json file
 */
const fs = require('fs').promises;
const createDbReader = require('./dbReader');

async function exportMetadata(filename, dataset_node_ids) {
  let reader;
  reader = createDbReader();
  await reader.init();
  const metadataCursor = await reader.readMetadata(dataset_node_ids);

  const metadata = await metadataCursor.toArray();
  await fs.writeFile(filename, JSON.stringify(metadata, null, 2))
  
  await reader.finish();
}

module.exports = exportMetadata;
