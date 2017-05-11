'use strict'

const path = require('path');
const expect = require('expect.js');
const _ = require('lodash');
const AWS = require('aws-sdk-mock');

AWS.setSDK(path.resolve('node_modules/aws-sdk'));

var StatusStream = require('../lib/status-stream');
var fixtures = require('./fixtures');

describe('Status Stream', function() {
  it('should return call describeServices with correct params', function(done) {
    AWS.mock('ECS', 'describeServices', function (params, cb){
      expect(params.cluster).to.equal('cluster-yo');
      expect(params.services).to.eql(['service-yo']);
      stream.destroy();
      AWS.restore('ECS', 'describeServices')
      done();
    });

    var stream = new StatusStream({cluster: 'cluster-yo', service: 'service-yo'});
    stream._read();
  });

  describe('Status Determination', function() {
    it('should return DEPLOYMENT_NOT_FOUND if no deployment matches taskDefinition provided', function() {
      var stream = new StatusStream({cluster: 'cluster-yo', service: 'service-yo', taskDefinition: 'wrong'});

      stream.determineStatus(fixtures['newDeployment']['services'][0]);
    })
  });
});
