'use strict'

const expect = require('expect.js');
const _ = require('lodash');
const AWS = require('aws-sdk-mock');
const sinon = require('sinon');

const helpers = require('./helpers');

var Service = require('../lib/service');
var fixtures = require('./fixtures');

describe('Service', function() {
  var instanceStub = null;

  afterEach(helpers.afterEach);

  beforeEach(() => {
    AWS.mock('ELBv2', 'describeTargetGroups', function (params, cb) {
      cb(null, { TargetGroups: [ 'tg' ] });
    });

    instanceStub = sinon
      .stub(Service.prototype, "_clusterContainerInstances")
      .callsFake((cb) => cb(null, ['instance']));
  });

  afterEach(() => {
    instanceStub.restore();
  })

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

    it('should return call _clusterContainerInstances', function(done) {
      AWS.mock('ECS', 'describeServices', function (params, cb){
        cb(null, fixtures['newDeployment']);
      });

      var service = new Service({clusterArn: 'cluster-yo', serviceName: 'service-yo'});
      service.on('updated', () => {
        expect(service.clusterContainerInstances).to.eql(['instance']);
        done();
      });
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

  describe('ClusterContainerInstances', function() {
    it('should return container instances', function(done) {
      instanceStub.restore();

      AWS.mock('ECS', 'listContainerInstances', function (params, cb) {
        expect(params.cluster).to.equal('cluster-yo');

        cb(null, {
          containerInstanceArns: [
            "arn::1",
            "arn::2"
          ]
        });
      });

      AWS.mock('ECS', 'describeContainerInstances', function (params, cb) {
        expect(params.cluster).to.equal('cluster-yo');

        cb(null, {
          containerInstances: [
            { containerInstanceArn: "arn::1", ec2InstanceId: "i-1" },
            { containerInstanceArn: "arn::2", ec2InstanceId: "i-2" }
          ]
        });
      });

      AWS.mock('EC2', 'describeInstances', function (params, cb) {
        expect(params.InstanceIds).to.eql(["i-1","i-2"]);

        cb(null, {
          Reservations: [
            {
              Instances: [
                {
                  InstanceId: "i-1",
                  PrivateIpAddress: '1.1'
                },
                {
                  InstanceId: "i-2",
                  PrivateIpAddress: '2.2'
                }
              ]
            }
          ]
        });
      });

      var service = new Service({clusterArn: 'cluster-yo', service: 'service-yo'});
      service._clusterContainerInstances((err, containerInstances) => {
        expect(containerInstances.length).to.equal(2);
        expect(containerInstances[0].PrivateIpAddress).to.equal('1.1');
        done();
      });
    });
  });
});
