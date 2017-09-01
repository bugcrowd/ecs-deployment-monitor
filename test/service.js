'use strict'

const expect = require('expect.js');
const _ = require('lodash');
const AWS = require('aws-sdk-mock');
const sinon = require('sinon');

const helpers = require('./helpers');

var Service = require('../lib/service');
var fixtures = require('./fixtures');

describe('Service', function() {
  var targetHealthStub = null;
  var containerInstanceStub = null;
  var serviceTasks = null;

  beforeEach(() => {
    targetHealthStub = sinon
      .stub(Service.prototype, "_targets")
      .callsFake((cb) => cb(null, ['target']));

    containerInstanceStub = sinon
      .stub(Service.prototype, "_clusterContainerInstances")
      .callsFake((cb) => cb(null, ['instance']));

    serviceTasks = sinon
      .stub(Service.prototype, "_tasks")
      .callsFake((cb) => cb(null, ['task']));
  });

  afterEach(() => {
    targetHealthStub.restore();
    containerInstanceStub.restore();
    serviceTasks.restore();
  });

  afterEach(helpers.afterEach);

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

      var service = new Service({clusterArn: 'cluster-yo', serviceName: 'service-yo'});
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

      var service = new Service({clusterArn: 'cluster-yo', serviceName: 'service-yo'});

      service.on('event', (event) => {
        expect(event.raw.id).to.equal("e1e75594-b9c9-4c32-bb90-89801bd89a62");
        service.destroy();
        done();
      });

      service.on('error', (error) => {
        console.log(error);
      });
    });
  });

  describe('Targets', function() {
    it('should return targets', function(done) {
      targetHealthStub.restore();

      AWS.mock('ECS', 'describeServices', function (params, cb){
        cb(null, fixtures['newDeployment']);
      });

      AWS.mock('ELBv2', 'describeTargetHealth', function (params, cb) {
        expect(params.TargetGroupArn).to.equal('arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/group/abcdef');

        cb(null, {
          TargetHealthDescriptions: [
            {
              Target: {
                Id: "i-1",
                Port: 25001
              },
              TargetHealth: {
                State: "healthy"
              }
            }
          ]
        });
      });

      var service = new Service({clusterArn: 'cluster-yo', serviceName: 'service-yo'});
      service.on('updated', () => {
        expect(service.targets.length).to.equal(1);
        done();
      });
    });

    it('should return a target via getTarget', function(done) {
      AWS.mock('ECS', 'describeServices', function (params, cb){
        cb(null, fixtures['newDeployment']);
      });

      var service = new Service({clusterArn: 'cluster-yo', serviceName: 'service-yo'});
      service.on('updated', () => {
        service.targets = [
          {
            HealthCheckPort: "25001",
            Target: {
              Id: "i-1",
              Port: 25001
            },
            TargetHealth: {
              State: "healthy"
            }
          },
          {
            HealthCheckPort: "25002",
            Target: {
              Id: "i-1",
              Port: 25002
            },
            TargetHealth: {
              State: "healthy"
            }
          }
        ];

        var target = service.getTarget("i-1", 25002);
        expect(target.Target.Port).to.equal(25002);

        done();
      });
    });
  });

  describe('ClusterContainerInstances', function() {
    it('should return container instances', function(done) {
      containerInstanceStub.restore();

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

      var service = new Service({clusterArn: 'cluster-yo', serviceName: 'service-yo'});
      service._clusterContainerInstances((err, containerInstances) => {
        expect(containerInstances.length).to.equal(2);
        expect(containerInstances[0].ec2InstanceId).to.equal('i-1');
        done();
      });
    });
  });

  describe('ServiceTasks', function() {
    it('should return tasks in a service', function(done) {
      serviceTasks.restore();

      AWS.mock('ECS', 'listTasks', function (params, cb) {
        expect(params.cluster).to.equal('cluster-yo');
        expect(params.serviceName).to.equal('service-yo');

        cb(null, {
          taskArns: [
            "arn::1",
            "arn::2"
          ]
        });
      });

      AWS.mock('ECS', 'describeTasks', function (params, cb) {
        expect(params.cluster).to.equal('cluster-yo');

        cb(null, {
          tasks: [
            { taskArn: 'arn:task:1' },
            { taskArn: 'arn:task:2' }
          ]
        });
      });

      var service = new Service({clusterArn: 'cluster-yo', serviceName: 'service-yo'});
      service._tasks((err, tasks) => {
        expect(tasks.length).to.equal(2);
        expect(tasks[0].taskArn).to.equal("arn:task:1");
        done();
      });
    });
  });
});
