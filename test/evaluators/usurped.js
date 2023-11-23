'use strict'

const expect = require('expect.js');
const EventEmitter = require('events');

const fixtures = require('../fixtures');

var Deployment = require('../../lib/deployment');
var evaluators = require('../../lib/evaluators');

describe('Evaluator:Usurped', function () {
  var evaluator = evaluators['Usurped'];

  it('should return FALSE when focused deployment is the primary deployment', function (done) {
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

  it('should return TRUE when focused deployment is NOT the primary deployment', function (done) {
    var service = new EventEmitter();
    service.initiated = true;
    service.raw = fixtures['newDeployment']['services'][0];

    var deployment = new Deployment({ service: service, taskDefinitionArn: 'arn:aws:ecs:us-east-1:123456789012:task-definition/app:110' });
    evaluator(deployment, (err, result) => {
      expect(result).to.equal(true);
      deployment.destroy();
      done();
    });
  });
});
