'use strict'

const expect = require('expect.js');
const EventEmitter = require('events');
const sinon = require('sinon');

const helpers = require('../helpers');
const fixtures = require('../fixtures');

var Deployment = require('../../lib/deployment');
var evaluators = require('../../lib/evaluators');

describe('Evaluator:Draining', function() {
  var evaluator = evaluators['Draining'];

  it('should return TRUE when there are no tasks that belong to the current deployment', function(done) {
    var service = new EventEmitter();
    service.raw = fixtures['newDeployment']['services'][0];
    service.runningTasks = () => [
      { taskArn: 'arn:task:1' },
      { taskArn: 'arn:task:2' }
    ];

    var deployment = new Deployment({service: service, taskDefinitionArn: service.raw.taskDefinition});
    deployment.history.push({state: 'Live'});
    deployment.doesTaskBelong = () => true;

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(true);
      deployment.destroy();
      done();
    });
  });

  it('should return FALSE when old tasks are healthy', function(done) {
    var service = new EventEmitter();
    service.raw = fixtures['newDeployment']['services'][0];
    service.runningTasks = () => [
      { taskArn: 'arn:task:1' },
      { taskArn: 'arn:task:2' }
    ];
    service.isTaskHealthy = () => true;

    var deployment = new Deployment({service: service, taskDefinitionArn: service.raw.taskDefinition});
    deployment.history.push({state: 'Live'});
    deployment.doesTaskBelong = () => false;

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(false);
      deployment.destroy();
      done();
    });
  });


  it('should return TRUE when there are no old healthy tasks', function(done) {
    var service = new EventEmitter();
    service.raw = fixtures['newDeployment']['services'][0];
    service.runningTasks = () => [
      { taskArn: 'arn:task:1' },
      { taskArn: 'arn:task:2' }
    ];
    service.isTaskHealthy = () => true;

    var deployment = new Deployment({service: service, taskDefinitionArn: service.raw.taskDefinition});
    deployment.history.push({ state: 'Live' });
    deployment.doesTaskBelong = () => true;

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(true);
      deployment.destroy();
      done();
    });
  });
});
