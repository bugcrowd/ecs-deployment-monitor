'use strict'

const path = require('path');
const expect = require('expect.js');
const AWS = require('aws-sdk-mock');

AWS.setSDK(path.resolve('node_modules/aws-sdk'));

const TasksStartedEvent = require('../../lib/events/tasks-started');

describe('TasksStartedEvent', function() {
  var rawEvent = {
    message: '(service app) has started 4 tasks: (task 8ddca76b-3ca5-4166-9cbb-aebdb8631861) (task 630213ae-e078-491e-8b67-4d3e2d1ce6fd) (task ec6a21c0-1f75-49fc-bbcd-144e77bd97b0) (task f61d518f-ef95-40a8-9ce9-afd6e1ada4a7).'
  }

  it('should detect a TasksStartedEvent event', function() {
    expect(TasksStartedEvent.test(rawEvent)).to.be.true;
  });

  it('should construct TasksStartedEvent object from event', function(done) {
    AWS.mock('ECS', 'describeTasks', function (params, cb){
      expect(params).to.eql({
        cluster: "cluster-yo",
        tasks: [
          '8ddca76b-3ca5-4166-9cbb-aebdb8631861',
          '630213ae-e078-491e-8b67-4d3e2d1ce6fd',
          'ec6a21c0-1f75-49fc-bbcd-144e77bd97b0',
          'f61d518f-ef95-40a8-9ce9-afd6e1ada4a7'
        ]
      });

      done(null, [ 1, 2, 3, 4 ]);
    });

    TasksStartedEvent.convert({ options: { cluster: 'cluster-yo' }}, rawEvent, (err, event) => {
      expect(err).to.equal(null);
      expect(event.tasks.length).to.equal(4);
      done();
    });
  });
});
