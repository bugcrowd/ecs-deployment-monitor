'use strict'

const expect = require('expect.js');

const TasksStoppedEvent = require('../../lib/events/tasks-stopped-event');

describe('Events:TasksStoppedEvent', function () {
  afterEach(helpers.afterEach);

  var rawEvent = {
    message: '(service app) has stopped 2 running tasks: (task aaa9d935-0ab2-45a9-aaac-5c75ed18f9a4) (task ae0efe15-0633-44f7-84fc-c265f9618a78).'
  }

  it('should detect a TasksStoppedEvent event', function () {
    expect(TasksStoppedEvent.test(rawEvent)).to.be.true;
  });
});
