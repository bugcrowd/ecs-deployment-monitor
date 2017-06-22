'use strict'

const AWS = require('aws-sdk');
const EventEmitter = require('events');
const async = require('async');
const _ = require('lodash');

const serviceEvents = require('./events');

class Deployment extends EventEmitter {
  constructor(options) {
    super();


    this.service = options.service;

    this.service.listen('event', this._serviceEventProcessor.bind(this));
  }

  _serviceEventListener(event) {
    this.emit('event', event);
  }
}

module.exports = function(options) {
  
}
