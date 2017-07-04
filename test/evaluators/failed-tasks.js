'use strict'

const expect = require('expect.js');
const EventEmitter = require('events');

const helpers = require('../helpers');
const fixtures = require('../fixtures');

var Deployment = require('../../lib/deployment');
var evaluators = require('../../lib/evaluators');


describe('Evaluator:FailedTasks', function() {
  var evaluator = evaluators['FailedTasks'];

  it('should return FALSE when no tasks have failed', function(done) {
    var service = new EventEmitter();
    service.initiated = true;
    service.raw = fixtures['newDeployment']['services'][0];

    var deployment = new Deployment({service: service, taskDefinitionArn: service.raw.taskDefinition});

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(false);
      deployment.destroy();
      done();
    });
  });

  it('should return FALSE when tasks have failed but not above the failure threshold', function(done) {
    var service = new EventEmitter();
    service.initiated = true;
    service.raw = fixtures['newDeployment']['services'][0];

    var deployment = new Deployment({service: service, taskDefinitionArn: service.raw.taskDefinition});
    deployment.tasksFailed.push('task');

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(false);
      deployment.destroy();
      done();
    });
  });

  it('should return TRUE when tasks have failed above the failure threshold', function(done) {
    var service = new EventEmitter();
    service.initiated = true;
    service.raw = fixtures['newDeployment']['services'][0];

    var deployment = new Deployment({service: service, taskDefinitionArn: service.raw.taskDefinition});
    deployment.tasksFailed.push('task1');
    deployment.tasksFailed.push('task2');
    deployment.tasksFailed.push('task3');

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(true);
      deployment.destroy();
      done();
    });
  });
});
