'use strict'

const expect = require('expect.js');
const AWS = require('aws-sdk-mock');

const helpers = require('../helpers');

const TasksStartedEvent = require('../../lib/events/tasks-started');

describe('Events:TasksStartedEvent', function() {
  afterEach(helpers.afterEach);

  var rawEvent = {
    message: '(service app) has started 4 tasks: (task 8ddca76b-3ca5-4166-9cbb-aebdb8631861) (task 630213ae-e078-491e-8b67-4d3e2d1ce6fd) (task ec6a21c0-1f75-49fc-bbcd-144e77bd97b0) (task f61d518f-ef95-40a8-9ce9-afd6e1ada4a7).'
  }

  it('should detect a TasksStartedEvent event', function() {
    expect(TasksStartedEvent.test(rawEvent)).to.be.true;
  });
});
