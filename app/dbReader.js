const r = require('rethinkdb');

module.exports = function() {
  let connection = null;
  const dbName = 'mirror';

  return {
    init() {
      return r
      .connect({host: 'rethinkdb', port: 28015})
      .then((conn) => {
         connection = conn;
         connection.use(dbName);
       });
    },

    readNodes(onlyNodes) {
      let nodes = r.table('nodes');
      if(onlyNodes) {
         nodes = nodes.getAll(r.args(onlyNodes), { index: 'node_id' });
      } else {
        nodes = nodes.orderBy('node_id', {index: 'node_id'});
      }
      return nodes.run(connection)
    },

    readFilesWithoutCreated() {
      return r.table('nodes').innerJoin(r.table('files'), function(nodesRow, filesRow) {
        return nodesRow.hasFields('file_url').and(filesRow('url').eq(nodesRow('file_url'))).and(filesRow.hasFields('revision_id')).and(filesRow.hasFields('created').not())
      }).zip().orderBy('node_id').run(connection);
    },

    readMetadata(dataset_node_ids) {
      return r.table('datasets').getAll(r.args(dataset_node_ids), {index: 'dataset_node_id'})
        .innerJoin(r.table('revisions'), function(datasetsRow, revisionsRow) {
          return datasetsRow('dataset_node_id').eq(revisionsRow('dataset_node_id'))
        })
        .zip()
        .innerJoin(r.table('files'), function(revisionsRow, filesRow) {
          return revisionsRow('revision_id').eq(filesRow('revision_id'))
        })
        .zip()
        .orderBy('revision_id').run(connection)
    },

    readTempRevisions(onlyNodes) {
      // array of nodes to filter by
      if(onlyNodes) {
        return r.table('temp_revisions').getAll(r.args(onlyNodes), {index: 'node_id'}).run(connection);
      }
      return r.table('temp_revisions').orderBy({index: 'revision_id'}).run(connection);
    },

    readRevisions() {
      return r.table('revisions').orderBy({index: 'revision_id'}).run(connection);
    },

    getTempRevision(revisionId) {
      return r.table('temp_revisions').get(revisionId).run(connection);
    },

    finish() {
      return connection.close().then(() => { connection = null; });
    },
  }
};
