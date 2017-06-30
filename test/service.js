'use strict'

const expect = require('expect.js');
const _ = require('lodash');
const AWS = require('aws-sdk-mock');
const sinon = require('sinon');

const helpers = require('./helpers');

var Service = require('../lib/service');
var fixtures = require('./fixtures');

describe('Service', function() {
  afterEach(helpers.afterEach);
  beforeEach(() => {
    AWS.mock('ELBv2', 'describeTargetGroups', function (params, cb) {
      cb(null, { TargetGroups: [ 'tg' ] });
    });
  });

  describe('Constructor', function() {
    it('should return call describeServices with correct params', function(done) {
      AWS.mock('ECS', 'describeServices', function (params, cb){
        expect(params.cluster).to.equal('cluster-yo');
        expect(params.services).to.eql(['service-yo']);
        service.destroy();
        done();
      });

      var service = new Service({clusterArn: 'cluster-yo', serviceName: 'service-yo'});
    });
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

  it('should load target groups from aws', function(done) {
    AWS.mock('ECS', 'describeServices', function (params, cb){
      cb(null, fixtures['tasksStartedDeployment']);
    });

    AWS.mock('ECS', 'describeTasks', function (params, cb){
      cb(null, { tasks: [1,2,3,4] });
    });

    var service = new Service({clusterArn: 'cluster-yo', service: 'service-yo'});
    service.on('updated', () => {
      expect(service.loadBalancers.length).to.equal(1);
      service.destroy();
      done();
    });
  });
});
