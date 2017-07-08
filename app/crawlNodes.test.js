jest.mock('./saver');
jest.mock('./requester');

const fs = require('fs');

const crawlNodes = require('./crawlNodes');
const createRequester = require('./requester');
const saver = require('./saver');

const requester = createRequester();

function* times(count, value) {
  let curr = count;

  while(curr > 0) {
    curr--;
    yield value;
  }
}

describe('crawlNodes', () => {

  it('parses response, skips 404s, saves nodes', () => {
    const sampleDataset = {
      canonical: 'http://data.gov.ua/passport/e33cdb18-b54e-4ec7-9f0d-a2afe7bbd28b',
      dataset_id: 'e33cdb18-b54e-4ec7-9f0d-a2afe7bbd28b',
      node_id: 92879,
      revision_id: 126496, 
    }
    requester.mockSetUp((url, resolve, reject) => {
      if(url.match('/node/12')) {
        resolve(fs.readFileSync('nodeDataset.html'));
      } else {
        reject({code: 404});
      }
    })
    return crawlNodes([13, 12, 11]).then(errors => {
      expect(errors).toEqual([...times(2, {code: 404})]);
      expect(saver.save).toBeCalledWith(sampleDataset);
    });
  });

});
