'use strict'

const expect = require('expect.js');
const EventEmitter = require('events');

const fixtures = require('../fixtures');

var Deployment = require('../../lib/deployment');
var evaluators = require('../../lib/evaluators');


describe('Evaluator:TasksStarted', function () {
  var evaluator = evaluators['TasksStarted'];

  it('should return FALSE when no tasks have been started', function (done) {
    var service = new EventEmitter();
    service.initiated = true;
    service.raw = fixtures['newDeployment']['services'][0];

    var deployment = new Deployment({ service: service, taskDefinitionArn: service.raw.taskDefinition });

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(false);
      deployment.destroy();
      done();
    });
  });

  it('should return TRUE when tasks have been started', function (done) {
    var service = new EventEmitter();
    service.initiated = true;
    service.raw = fixtures['newDeployment']['services'][0];

    var deployment = new Deployment({ service: service, taskDefinitionArn: service.raw.taskDefinition });
    deployment.tasksStarted.push('task');

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(true);
      deployment.destroy();
      done();
    });
  });
});
