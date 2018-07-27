'use strict'

const path = require('path');
const AWS = require('aws-sdk-mock');

// Set the default region to 'us-east-1' if not already set
if (!AWS.config.region) {
  AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
  });
}

AWS.setSDK(path.resolve('node_modules/aws-sdk'));

module.exports = {
  afterEach: () => AWS.restore();
}
