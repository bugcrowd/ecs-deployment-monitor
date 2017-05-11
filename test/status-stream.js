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
    it('should return DEPLOYMENT_NOT_FOUND if no deployment matches taskDefinition provided', function(done) {
      var stream = new StatusStream({cluster: 'cluster-yo', service: 'service-yo', taskDefinition: 'wrong'});
      var result = stream.determineStatus(fixtures['newDeployment']['services'][0]);
      stream.destroy();

      expect(result.status).to.equal('DEPLOYMENT_NOT_FOUND');
      done();
    });

    it('should return DEPLOY_USURPED the deployment is no longer the primary deployment', function(done) {
      var stream = new StatusStream({
        cluster: 'cluster-yo',
        service: 'service-yo',
        taskDefinition: 'arn:aws:ecs:us-east-1:123456789012:task-definition/app:111'
      });
      
      var result = stream.determineStatus(fixtures['usurpedDeployment']['services'][0]);
      stream.destroy();

      expect(result.status).to.equal('DEPLOY_USURPED');
      done();
    });
  });
});
