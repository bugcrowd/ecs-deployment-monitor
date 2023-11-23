'use strict'

const expect = require('expect.js');
const { mockClient } = require('aws-sdk-client-mock');
const {
  ECS,
  DescribeTasksCommand
} = require('@aws-sdk/client-ecs');

const tasks = require('../../lib/resources/tasks');

describe('Resources:Tasks', function () {
  const ecsMock = mockClient(ECS);
  afterEach(() => { ecsMock.reset(); });
  beforeEach(() => { ecsMock.reset(); });

  it('should load tasks from AWS', function (done) {
    ecsMock.on(DescribeTasksCommand).callsFake((params) => {
      expect(params).to.eql({
        cluster: 'yo',
        tasks: ['task1', 'task2']
      });

      return Promise.resolve({ tasks: [1, 2] });
    });

    const service = { options: { clusterArn: 'yo' } };

    tasks(service, ['task1', 'task2'], (err, tasks) => {
      expect(err).to.equal(null);
      expect(tasks).to.eql([1, 2]);
      done();
    });
  });
});
