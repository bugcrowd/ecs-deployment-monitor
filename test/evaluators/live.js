'use strict'

const expect = require('expect.js');
const EventEmitter = require('events');

const fixtures = require('../fixtures');

var Deployment = require('../../lib/deployment');
var evaluators = require('../../lib/evaluators');

describe('Evaluator:Live', function () {
  var evaluator = evaluators['Live'];

  it('should return FALSE when there are no active tasks', function (done) {
    var service = new EventEmitter();
    service.raw = fixtures['newDeployment']['services'][0];

    var deployment = new Deployment({ service: service, taskDefinitionArn: service.raw.taskDefinition });

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(false);
      deployment.destroy();
      done();
    });
  });

  it('should return FALSE when active tasks are not healthy', function (done) {
    var service = new EventEmitter();
    service.raw = fixtures['newDeployment']['services'][0];

    service.isTaskHealthy = () => false;

    var deployment = new Deployment({ service: service, taskDefinitionArn: service.raw.taskDefinition });
    deployment.history.push({ state: 'TasksStarted' });
    deployment.tasksStarted = ["arn::task:1", "arn::task:2"];

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(false);
      deployment.destroy();
      done();
    });
  });

  it('should return TRUE when number of healthy tasks are equal to or greater than the desired count', function (done) {
    var service = new EventEmitter();
    service.raw = fixtures['newDeployment']['services'][0];

    service.isTaskHealthy = () => true;

    var deployment = new Deployment({ service: service, taskDefinitionArn: service.raw.taskDefinition });
    deployment.history.push({ state: 'TasksStarted' });
    deployment.tasksStarted = [
      "arn::task:1",
      "arn::task:2",
      "arn::task:3",
      "arn::task:4"
    ];

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(true);
      deployment.destroy();
      done();
    });
  });
});
