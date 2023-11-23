'use strict'

const expect = require('expect.js');

const tasks = require('../../lib/resources/tasks');

describe('Resources:Tasks', function () {
  afterEach(helpers.afterEach);

  it('should load tasks from AWS', function (done) {
    AWS.mock('ECS', 'describeTasks', function (params, cb) {
      expect(params).to.eql({
        cluster: 'yo',
        tasks: ['task1', 'task2']
      });

      cb(null, { tasks: [1, 2] });
    });

    var service = { options: { clusterArn: 'yo' } };

    tasks(service, ['task1', 'task2'], (err, tasks) => {
      expect(err).to.equal(null);
      expect(tasks).to.eql([1, 2]);
      done();
    });
  });
});
