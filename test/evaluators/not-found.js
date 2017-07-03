'use strict'

const expect = require('expect.js');
const EventEmitter = require('events');

const helpers = require('../helpers');
const fixtures = require('../fixtures');

var Deployment = require('../../lib/deployment');
var evaluators = require('../../lib/evaluators');

describe('Evaluator:Not Found', function() {
  var evaluator = evaluators['NotFound'];

  it('should return FALSE when deployment was found', function(done) {
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

  it('should return TRUE when deployment was NOT found', function(done) {
    var service = new EventEmitter();
    service.initiated = true;
    service.raw = fixtures['newDeployment']['services'][0];

    var deployment = new Deployment({service: service, taskDefinitionArn: 'missing'});
    evaluator(deployment, (err, result) => {
      expect(result).to.equal(true);
      deployment.destroy();
      done();
    });
  });
});
