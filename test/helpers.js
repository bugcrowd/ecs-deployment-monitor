'use strict'

const path = require('path');
const AWS = require('aws-sdk-mock');

AWS.setSDK(path.resolve('node_modules/aws-sdk'));

module.exports = {
  afterEach: () => AWS.restore()
}
