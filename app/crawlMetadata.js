/**
 * Input: node: node_id, revision_id, dataset_id
 * Output: revisions.csv: (revision_id, date, node_id, dataset_id)
 */
const cheerio = require('cheerio');
const Promise = require('bluebird');
const r = require("rethinkdb");

const createRequester = require('./requester');
const saver = require('./saver');
const parser = require('./parser');

const requester = createRequester();

function visited(node) {
  return false;
}

function fetchMetadata(dataset_id, revision_id) {
  return requester.request(`/view-dataset/dataset.json?dataset-id=${dataset_id}&revision-id=${revision_id}`)
  .then(res => JSON.parse(res));
}

function getMetadata(revision) {
  return fetchMetadata(revision.dataset_id, revision.revision_id)
  .then((metadata) => {
    let revisions = metadata.revisions;
    
    delete metadata.revisions;
    return { metadata, revisions };
  });
}

function createSaver() {
  let connection = null;
  const dbName = 'mirror';

  return {
    init() {
      return r
      .connect({host: 'rethinkdb', port: 28015})
      .then((conn) => { connection = conn; })
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
        .then(() => this.createTable('files', 'url'));
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
          fallbackRevisions = [{ revision_id: parseInt(metadata.revision_id), revision_created: metadata.changed }];
        } else {
          console.log('no revisions, no fallback');
          return Promise.resolve();
        }
      } else {
        revisions.forEach((rev) => {
          rev.revision_id = parseInt(rev.revision_id);
          rev.revision_created = rev.created;
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
      };
      let organization_id;
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

    saveRevision(revision) {
      return r
        .table('revisions')
        .insert(revision, { conflict: 'update' })
        .run(connection)
    },

    saveOrganization(organization) {
      return r
        .table('organizations')
        .insert(organization, { conflict: 'update' })
        .run(connection);
    },

    saveFiles(files) {
      return r
        .table('files')
        .insert(files, { conflict: 'update' })
        .run(connection);
    },

    finish() {
      return connection.close();
    }
  };
}


module.exports = function crawlMetadata(itemArray) {
  let errors = [];
  const databaseSaver = new createSaver();

  saver.init('/data/metadata.csv');
  return databaseSaver.init().then(() => requester.init()).then(() => {
    return new Promise((resolve, reject) => {
      function scheduleNext(itemArray) {
        let item = itemArray.shift();
        if(!item) {
          databaseSaver.finish()
            .then(() => saver.finish())
            .then(() => requester.finish())
            .then(() => resolve(errors));
        } else if(visited(item)) {
          process.nextTick(() => scheduleNext(itemArray));
        } else {
          process.nextTick(() => {
            return getMetadata(item)
              .then(metadata => {
                /* save revisions */
                //if(metadata.revisions) {
                //  metadata.revisions.forEach(revision => saver.save(revision));
                //}
                return databaseSaver.saveRevisions(metadata);
//                return saver.save(metadata.revisions);
              })
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
    }).catch((err) => {
      databaseSaver.finish().then(() => {
        throw err;
      });
    });
  });
}
