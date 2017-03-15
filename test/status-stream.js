'use strict'

var expect = require('expect.js');
var AWS = require('aws-sdk-mock');

var StatusStream = require('../lib/status-stream');

describe('Status Stream', function() {
  it('should return call describeServices with correct params', function(done) {
    AWS.mock('ECS', 'describeServices', function (params, cb){
      expect(params.cluster).to.equal('cluster-yo');
      expect(params.services).to.eql(['service-yo']);
      done();
    });

    var stream = new StatusStream({cluster: 'cluster-yo', service: 'service-yo'});
    stream._read();
  });

});
