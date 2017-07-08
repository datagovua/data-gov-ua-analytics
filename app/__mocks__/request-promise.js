const rpErrors = require('request-promise/errors');

let currentMock;

let request = function request(url) {
  let error, response, body;
  if(currentMock) {
    mock = currentMock(url);
    error = mock.error;
    response = { statusCode: mock.code };
    body = mock.text;
  } else {
    error = undefined;
    response = { statusCode: 200 };
    body = '';
  }
  return new Promise((resolve, reject) => {
    if(response.statusCode == 200) {
      resolve(body);
    } else {
      reject(new rpErrors.StatusCodeError(response.statusCode, body, null, response));
    }
  });
};

request.defaults = function() { return request };

request.setup = function(mock) {
  currentMock = mock;
};

request.unsetup = function() {
  currentMock = undefined;
};

module.exports = request;
