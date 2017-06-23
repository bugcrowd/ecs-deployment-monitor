'use strict'

const path = require('path');
const expect = require('expect.js');
const _ = require('lodash');
const AWS = require('aws-sdk-mock');

AWS.setSDK(path.resolve('node_modules/aws-sdk'));

var Service = require('../lib/service');
var fixtures = require('./fixtures');

describe('Service', function() {
  afterEach(() => AWS.restore());

  it('should return call describeServices with correct params', function(done) {
    AWS.mock('ECS', 'describeServices', function (params, cb){
      expect(params.cluster).to.equal('cluster-yo');
      expect(params.services).to.eql(['service-yo']);
      service.destroy();
      done();
    });

    var service = new Service({clusterArn: 'cluster-yo', serviceName: 'service-yo'});
  });

  describe('Cluster Events', function() {
    it('should pluck events since timestamp', function(done) {
      AWS.mock('ECS', 'describeServices', function (params, cb){
        cb(null, fixtures['newDeployment']);
      });

      var service = new Service({clusterArn: 'cluster-yo', service: 'service-yo'});
      var events = service._pluckEventsSince(fixtures['newDeployment']['services'][0]['events'], 1494960755);
      service.destroy();

      expect(events.length).to.equal(5);
      done();
    });

    it('should emit new event', function(done) {
      AWS.mock('ECS', 'describeServices', function (params, cb){
        cb(null, fixtures['tasksStartedDeployment']);
      });

      AWS.mock('ECS', 'describeTasks', function (params, cb){
        cb(null, { tasks: [1,2,3,4] });
      });

      var service = new Service({clusterArn: 'cluster-yo', service: 'service-yo'});

      service.on('event', (event) => {
        expect(event.raw.id).to.equal("e1e75594-b9c9-4c32-bb90-89801bd89a62");
        service.destroy();
        done();
      });
    });
  });
});
