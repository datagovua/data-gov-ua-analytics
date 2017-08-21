const r = require("rethinkdb");


module.exports = function createSaver() {
  let connection = null;
  const dbName = 'mirror';

  return {
    init() {
      return r
      .connect({host: 'rethinkdb', port: 28015})
      .then((conn) => { connection = conn; console.log('connection opened') })
      .then(() => {
        return r
        .dbCreate(dbName)
        .run(connection)
        .catch((err) => {
          if(!err.message.match('Database `' + dbName + '` already exists')) {
            throw err;
          }
        });
      })
      .then(() => {
        connection.use(dbName);
        return this.createTables();
      })
      .then(() => {
        return this.createIndexes();
      });
    },

    createTables() {
      return this.createTable('revisions', 'revision_id')
        .then(() => this.createTable('organizations', 'organization_id'))
        .then(() => this.createTable('files', 'url'))
        .then(() => this.createTable('temp_revisions', 'revision_id'))
        .then(() => this.createTable('datasets', 'dataset_node_id'))
        .then(() => this.createTable('nodes', 'node_id'));
    },

    createTable(tableName, primaryKey) {
      return r
        .tableCreate(tableName, { primaryKey: primaryKey })
        .run(connection)
        .catch(err => {
          if(!err.message.match('Table `' + dbName + '.' + tableName + '` already exists')) {
            throw err;
          }
        })
    },

    createIndexes() {
      return this.createIndex('revisions', 'node_id')
        .then(() => this.createIndex('revisions', 'organization_id'))
        .then(() => this.createIndex('files', 'revision_id'))
    },

    createIndex(tableName, indexName) {
      return r
        .table(tableName)
        .indexCreate(indexName)
        .run(connection)
        .catch((err) => {
          if(!err.message.match('Index `' + indexName + '` already exists on table')) {
            throw err;
          }
        });
    },

    saveRevisions(data) {
      let fallbackRevisions;
      const { revisions, metadata } = data;
      if(!revisions || revisions.length == 0) {
        console.log('Revisions is empty, fallback to last changed');
        if(metadata.revision_id && metadata.last_revision_id === metadata.revision_id) {
          fallbackRevisions = [{
            revision_id: parseInt(metadata.revision_id),
            revision_created: metadata.changed,
            dataset_node_id: metadata.dataset_node_id,
          }];
        } else {
          console.log('no revisions, no fallback');
          return Promise.resolve();
        }
      } else {
        revisions.forEach((rev) => {
          rev.revision_id = parseInt(rev.revision_id);
          rev.revision_created = rev.created;
          rev.dataset_node_id = metadata.dataset_node_id;
          delete rev.created;
        });
      }
      return r
        .table('revisions')
        .insert(fallbackRevisions || revisions, { conflict: 'update' })
        .run(connection)
        .catch(err => { console.log(revisions);})
        .then(() => this.saveRevisionMetadata(metadata));
    },

    saveRevisionMetadata(metadata) {
      let dataToSave = {
        revision_id: parseInt(metadata.revision_id),
        dataset_id: metadata.dataset_id,
        title: metadata.title,
        description: metadata.description,
        // files: metadata.files,
        // author: metadata.author.organization_name,
        responsible_person: metadata.responsible_person,
        // category,
        // format_dataset,
        // keywords,
        // language,
        dataset_node_id: metadata.dataset_node_id,
      };
      if(isNaN(dataToSave.revision_id)) {
        delete dataToSave.revision_id;
      }
      let organization_id;
      // files can be undefined
      if(!metadata.files) { metadata.files = []; }
      metadata.files.forEach((file) => {
        file.revision_id = parseInt(metadata.revision_id);
        file.base_url = 'http://data.gov.ua/sites/default/files/media/';
        file.url = file.url.replace(file.base_url, '');
        organization_id = file.url.match(/(?:document|image)\/(\d+)\//);
        if(!organization_id) {
          throw 'file without organization id: ' + file.url;
        } else {
          organization_id = parseInt(organization_id[1]);
          if(organization_id === 1) {
            organization_id = 141;
          }
        }
      });
      metadata.author.organization_id = organization_id;
      dataToSave.organization_id = organization_id;
      return this.saveRevision(dataToSave)
        .then(() => this.saveOrganization(metadata.author))
        .then(() => this.saveFiles(metadata.files));
    },

    saveObject(tableName, object) {
      return r
        .table(tableName)
        .insert(object, { conflict: 'update' })
        .run(connection);
    },

    saveRevision(revision) {
      return this.saveObject('revisions', revision);
    },

    saveOrganization(organization) {
      return this.saveObject('organizations', organization);
    },

    saveFiles(files) {
      return this.saveObject('files', files);
    },

    saveNode(node) {
      node.revision_id = null;
      return this.saveObject('nodes', node);
    },

    saveTempRevisions(revisions) {
      return this.saveObject('temp_revisions', revisions);
    },

    saveDataset(dataset) {
      return this.saveObject('datasets', dataset);
    },

    finish() {
      return connection.close().then(() => { connection = null; console.log('connection closed') });
    }
  };
}
