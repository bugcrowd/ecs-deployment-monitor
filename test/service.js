'use strict';

const expect = require('expect.js');
const _ = require('lodash');
const sinon = require('sinon');
const { mockClient } = require('aws-sdk-client-mock');
const {
  ECS,
  DescribeServicesCommand,
  DescribeTasksCommand,
  ListContainerInstancesCommand,
  DescribeContainerInstancesCommand,
  ListTasksCommand
} = require('@aws-sdk/client-ecs');
const {
  ElasticLoadBalancingV2: ELBv2,
  DescribeTargetHealthCommand
} = require('@aws-sdk/client-elastic-load-balancing-v2');

const Service = require('../lib/service');
const fixtures = require('./fixtures');

describe('Service', function () {
  let serviceDependencyFixtures = {
    targets: ['target'],
    containerInstances: ['instance'],
    tasks: ['task'],
  };
  const ecsMock = mockClient(ECS);
  const elbMock = mockClient(ELBv2);

  const originalServiceDependencyFixtures = _.cloneDeep(serviceDependencyFixtures);

  let targetHealthStub = null;
  let containerInstanceStub = null;
  let serviceTasks = null;

  function setServiceDependencyFixture(type, data) {
    serviceDependencyFixtures[type] = data;
  }

  beforeEach(() => {
    targetHealthStub = sinon
      .stub(Service.prototype, '_targets')
      .callsFake(() => serviceDependencyFixtures['targets']);

    containerInstanceStub = sinon
      .stub(Service.prototype, '_clusterContainerInstances')
      .callsFake(() => serviceDependencyFixtures['containerInstances']);

    serviceTasks = sinon
      .stub(Service.prototype, '_tasks')
      .callsFake(() => serviceDependencyFixtures['tasks']);
  });

  afterEach(() => {
    serviceDependencyFixtures = _.cloneDeep(originalServiceDependencyFixtures);
    targetHealthStub.restore();
    containerInstanceStub.restore();
    serviceTasks.restore();
    ecsMock.reset();
    elbMock.reset();
  });

  describe('Constructor', function () {
    it('should return call describeServices with correct params', function (done) {
      const fakeServiceResponse = {
        services: [{
          serviceArn: 'arn:0',
          deployments: []
        }]
      };

      ecsMock.on(DescribeServicesCommand).callsFake((params) => {
        service.destroy();
        expect(params.cluster).to.equal('cluster-0');
        expect(params.services).to.eql(['service-0']);
        done();
        return Promise.resolve(fakeServiceResponse);
      });

      const service = new Service({ clusterArn: 'cluster-0', serviceName: 'service-0' });
    });

    it('should return call _clusterContainerInstances', function (done) {
      ecsMock.on(DescribeServicesCommand).resolves(fixtures['newDeployment']);

      const service = new Service({ clusterArn: 'cluster-1', serviceName: 'service-1' });
      service.on('updated', () => {
        service.destroy();
        expect(service.clusterContainerInstances).to.eql(['instance']);
        done();
      });
    });
  });

  describe('Cluster Events', function () {
    it('should pluck events since timestamp', function (done) {
      ecsMock.on(DescribeServicesCommand).resolves(fixtures['newDeployment']);

      const service = new Service({ clusterArn: 'cluster-2', serviceName: 'service-2' });
      const events = service._pluckEventsSince(fixtures['newDeployment']['services'][0]['events'], 1494960755);
      service.destroy();

      expect(events.length).to.equal(5);
      done();
    });

    it('should emit new event', function (done) {
      ecsMock.on(DescribeServicesCommand).resolves(fixtures['tasksStartedDeployment']);
      ecsMock.on(DescribeTasksCommand).resolves({ tasks: [1, 2, 3, 4] });

      const service = new Service({ clusterArn: 'cluster-3', serviceName: 'service-3' });

      service.on('event', (event) => {
        service.destroy();
        expect(event.raw.id).to.equal('e1e75594-b9c9-4c32-bb90-89801bd89a62');
        done();
      });

      service.on('error', (error) => {
        console.log(error);
      });
    });
  });

  describe('Targets', function () {
    it('should return targets', function (done) {
      targetHealthStub.restore();

      ecsMock.on(DescribeServicesCommand).resolves(fixtures['newDeployment']);
      elbMock.on(DescribeTargetHealthCommand).callsFake((params) => {
        expect(params.TargetGroupArn).to.equal('arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/group/abcdef');

        return Promise.resolve({
          TargetHealthDescriptions: [
            {
              Target: {
                Id: 'i-1',
                Port: 25001,
              },
              TargetHealth: {
                State: 'healthy',
              },
            },
          ],
        });
      });

      const service = new Service({ clusterArn: 'cluster-4', serviceName: 'service-4' });
      service.on('updated', () => {
        service.destroy();
        expect(service.targets.length).to.equal(1);
        done();
      });
    });

    it('should return a target via getTarget', function (done) {
      ecsMock.on(DescribeServicesCommand).resolves(fixtures['newDeployment']);

      const service = new Service({ clusterArn: 'cluster-yo5', serviceName: 'service-yo5' });
      service.on('updated', () => {
        service.targets = [
          {
            HealthCheckPort: '25001',
            Target: {
              Id: 'i-1',
              Port: 25001,
            },
            TargetHealth: {
              State: 'healthy',
            },
          },
          {
            HealthCheckPort: '25002',
            Target: {
              Id: 'i-1',
              Port: 25002,
            },
            TargetHealth: {
              State: 'healthy',
            },
          },
        ];

        const target = service.getTarget('i-1', 25002);
        service.destroy();
        expect(target.Target.Port).to.equal(25002);

        done();
      });
    });
  });

  describe('ClusterContainerInstances', function () {
    it('should return container instances', async function () {
      containerInstanceStub.restore();

      ecsMock.on(ListContainerInstancesCommand).callsFake((params) => {
        expect(params.cluster).to.equal('cluster-6');

        return Promise.resolve({
          containerInstanceArns: [
            'arn::1',
            'arn::2',
          ],
        });
      });

      ecsMock.on(DescribeContainerInstancesCommand).callsFake((params) => {
        expect(params.cluster).to.equal('cluster-6');

        return Promise.resolve({
          containerInstances: [
            { containerInstanceArn: 'arn::1', ec2InstanceId: 'i-1' },
            { containerInstanceArn: 'arn::2', ec2InstanceId: 'i-2' },
          ],
        });
      });

      ecsMock.on(DescribeServicesCommand).resolves(fixtures['newDeployment']);

      const service = new Service({ clusterArn: 'cluster-6', serviceName: 'service-6' });
      const containerInstances = await service._clusterContainerInstances();
      service.destroy();
      expect(containerInstances.length).to.equal(2);
      expect(containerInstances[0].ec2InstanceId).to.equal('i-1');
    });
  });

  describe('ServiceTasks', function () {
    it('should return tasks in a service', async function () {
      serviceTasks.restore();

      ecsMock.on(ListTasksCommand).callsFake((params) => {
        expect(params.cluster).to.equal('cluster-7');
        expect(params.serviceName).to.equal('service-7');

        return Promise.resolve({
          taskArns: [
            'arn::1',
            'arn::2',
          ],
        });
      });

      ecsMock.on(DescribeServicesCommand).resolves(fixtures['newDeployment']);

      ecsMock.on(DescribeTasksCommand).callsFake((params) => {
        expect(params.cluster).to.equal('cluster-7');

        return Promise.resolve({
          tasks: [
            { taskArn: 'arn:task:1' },
            { taskArn: 'arn:task:2' },
          ],
        });
      });

      const service = new Service({ clusterArn: 'cluster-7', serviceName: 'service-7' });
      const tasks = await service._tasks();
      service.destroy();
      expect(tasks.length).to.equal(2);
      expect(tasks[0].taskArn).to.equal('arn:task:1');
    });

    it('should handle no tasks in a service', async function () {
      serviceTasks.restore();

      ecsMock.on(DescribeServicesCommand).resolves(fixtures['newDeployment']);
      ecsMock.on(ListTasksCommand).callsFake((params) => {
        expect(params.cluster).to.equal('cluster-8');
        expect(params.serviceName).to.equal('service-8');

        return Promise.resolve({
          taskArns: [],
        });
      });

      ecsMock.on(DescribeTasksCommand).callsFake((params) => {
        // We should not be calling describe tasks when no tasks are in the service
        expect(true).to.equal(false);
      });

      const service = new Service({ clusterArn: 'cluster-8', serviceName: 'service-8' });
      const tasks = await service._tasks();
      service.destroy();
      expect(tasks.length).to.equal(0);
    });
  });

  describe('Target Health EC2', function () {
    beforeEach(() => {
      setServiceDependencyFixture('targets', [
        {
          Target: {
            Id: 'i-1',
            Port: 25001,
          },
          TargetHealth: {
            State: 'unhealthy',
          },
        },
        {
          Target: {
            Id: 'i-1',
            Port: 25002,
          },
          TargetHealth: {
            State: 'healthy',
          },
        },
      ]);

      setServiceDependencyFixture('containerInstances', [
        {
          containerInstanceArn: 'arn::ci:1',
          ec2InstanceId: 'i-1',
        },
      ]);

      setServiceDependencyFixture('tasks', [
        {
          taskArn: 'arn::task:1',
          containerInstanceArn: 'arn::ci:1',
          containers: [
            {
              name: 'app',
              networkBindings: [
                {
                  hostPort: 25001,
                },
              ],
            },
          ],
        },
        {
          taskArn: 'arn::task:2',
          containerInstanceArn: 'arn::ci:1',
          containers: [
            {
              name: 'app',
              networkBindings: [
                {
                  hostPort: 25002,
                },
              ],
            },
          ],
        },
      ]);
    });

    it('should report task health', function (done) {
      ecsMock.on(DescribeServicesCommand).resolves(fixtures['newDeployment']);

      const service = new Service({ clusterArn: 'cluster-9', serviceName: 'service-9' });

      service.on('updated', function () {
        service.destroy();
        expect(service.isTaskHealthy('arn::task:1')).to.equal(false);
        expect(service.isTaskHealthy('arn::task:2')).to.equal(true);
        done();
      });
    });
  });

  describe('Target Health Fargate', function () {
    beforeEach(() => {
      setServiceDependencyFixture('targets', [
        {
          Target: {
            Id: '192.0.2.1',
            Port: 8443,
          },
          TargetHealth: {
            State: 'healthy',
          },
        },
        {
          Target: {
            Id: '192.0.2.2',
            Port: 8443,
          },
          TargetHealth: {
            State: 'unhealthy',
          },
        },
      ]);

      setServiceDependencyFixture('tasks', [
        {
          taskArn: 'arn:aws:ecs:us-east-1:12345789012:task/mycluster/abcdefgh',
          containers: [
            {
              'name': 'app',
            },
          ],
          attachments: [
            {
              'type': 'ElasticNetworkInterface',
              'details': [
                {
                  'name': 'privateIPv4Address',
                  'value': '192.0.2.1',
                },
              ],
            },
          ],
        },
        {
          taskArn: 'arn:aws:ecs:us-east-1:12345789012:task/mycluster/bcdefghi',
          containers: [
            {
              'name': 'app',
            },
          ],
          attachments: [
            {
              'type': 'ElasticNetworkInterface',
              'details': [
                {
                  'name': 'privateIPv4Address',
                  'value': '192.0.2.2',
                },
              ],
            },
          ],
        },
        {
          taskArn: 'arn:aws:ecs:us-east-1:12345789012:task/mycluster/cdefghij',
          containers: [
            {
              'name': 'app',
            },
          ],
          attachments: [
            {
              'type': 'ElasticNetworkInterface',
              'details': [
                {
                  'name': 'privateIPv4Address',
                  'value': '192.0.2.3',
                },
              ],
            },
          ],
        },
      ]);
    });

    it('should report task health', function (done) {
      ecsMock.on(DescribeServicesCommand).resolves(fixtures['fargateDeployment']);

      // lib/resources/tasks has an ECS/describeTasks call that needs hooking
      // to prevent the actual SDK from trying to make a call. We don't see the
      // results from it here so no-op is fine.
      ecsMock.on(DescribeTasksCommand).resolves({});

      const service = new Service({ clusterArn: 'arn:aws:ecs:us-east-1:12345789012:cluster/mycluster', serviceName: 'my-test-application' });

      service.on('updated', function () {
        service.destroy();
        expect(service.isTaskHealthy('arn:aws:ecs:us-east-1:12345789012:task/mycluster/abcdefgh')).to.equal(true);
        expect(service.isTaskHealthy('arn:aws:ecs:us-east-1:12345789012:task/mycluster/bcdefghi')).to.equal(false);
        expect(service.isTaskHealthy('arn:aws:ecs:us-east-1:12345789012:task/mycluster/cdefghij')).to.equal(false);
        done();
      });
    });
  });

  describe('_getTargetsForFargateTask', () => {
    beforeEach(() => {
      setServiceDependencyFixture('targets', [
        {
          Target: {
            Id: '192.0.2.1',
            Port: 8443,
          },
          AvailabilityZone: 'us-east-1b',
          HealthCheckPort: 8443,
          TargetHealth: {
            State: 'healthy',
          },
        },
        {
          Target: {
            Id: '192.0.2.2',
            Port: 8443,
          },
          AvailabilityZone: 'us-east-1c',
          HealthCheckPort: 8443,
          TargetHealth: {
            State: 'healthy',
          },
        },
      ]);

      setServiceDependencyFixture('tasks', [
        {
          taskArn: 'arn:aws:ecs:us-east-1:12345789012:task/mycluster/abcdefgh',
          containers: [
            {
              'name': 'app',
            },
          ],
          attachments: [
            {
              'type': 'ElasticNetworkInterface',
              'details': [
                {
                  'name': 'privateIPv4Address',
                  'value': '192.0.2.1',
                },
              ],
            },
          ],
        },
        {
          taskArn: 'arn:aws:ecs:us-east-1:12345789012:task/mycluster/bcdefghi',
          containers: [
            {
              'name': 'app',
            },
          ],
          attachments: [
            {
              'type': 'ElasticNetworkInterface',
              'details': [
                {
                  'name': 'privateIPv4Address',
                  'value': '192.0.2.100',
                },
              ],
            },
          ],
        }
      ]);
    });

    it('should find matching tasks by IP', (done) => {
      ecsMock.on(DescribeServicesCommand).resolves(fixtures['fargateDeployment']);
      ecsMock.on(DescribeTasksCommand).resolves({});

      const service = new Service({ clusterArn: 'arn:aws:ecs:us-east-1:12345789012:cluster/mycluster', serviceName: 'my-test-application' });

      service.on('updated', function () {
        service.destroy();
        expect(service._getTargetsForFargateTask(service.tasks[0], 8443).length).to.equal(1);
        expect(service._getTargetsForFargateTask(service.tasks[1], 8443).length).to.equal(0);
        done();
      });
    });
  });
});

