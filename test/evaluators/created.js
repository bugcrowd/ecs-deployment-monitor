'use strict'

const expect = require('expect.js');
const EventEmitter = require('events');

const helpers = require('../helpers');
const fixtures = require('../fixtures');

var Deployment = require('../../lib/deployment');
var evaluators = require('../../lib/evaluators');

describe('Evaluator:Created', function() {
  var evaluator = evaluators['Created'];

  it('should return FALSE when focused deployment does not exists', function(done) {
    var service = new EventEmitter();
    service.initiated = true;
    service.raw = fixtures['newDeployment']['services'][0];

    var deployment = new Deployment({service: service, taskDefinitionArn: 'asdf' });
    evaluator(deployment, (err, result) => {
      expect(result).to.equal(false);
      deployment.destroy();
      done();
    });
  });

  it('should return TRUE when focused deployment exists', function(done) {
    var service = new EventEmitter();
    service.initiated = true;
    service.raw = fixtures['newDeployment']['services'][0];

    var deployment = new Deployment({service: service, taskDefinitionArn: service.raw.taskDefinition});
    evaluator(deployment, (err, result) => {
      expect(result).to.equal(true);
      deployment.destroy();
      done();
    });
  });
});
