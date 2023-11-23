'use strict'

const expect = require('expect.js');
const EventEmitter = require('events');

const fixtures = require('../fixtures');

var Deployment = require('../../lib/deployment');
var evaluators = require('../../lib/evaluators');

describe('Evaluator:Live', function () {
  var evaluator = evaluators['Steady'];

  it('should return FALSE when deployment is not steady', function (done) {
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

  it('should return TRUE when number of healthy tasks are equal to or greater than the desired count', function (done) {
    var service = new EventEmitter();
    service.initiated = true;
    service.raw = fixtures['newDeployment']['services'][0];

    var deployment = new Deployment({ service: service, taskDefinitionArn: service.raw.taskDefinition });
    deployment.steady = true;
    deployment.history.push({ state: 'Live' });

    evaluator(deployment, (err, result) => {
      expect(result).to.equal(true);
      deployment.destroy();
      done();
    });
  });
});
