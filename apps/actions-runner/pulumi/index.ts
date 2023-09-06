import { bedrockRef } from '@penxle/pulumi';
import * as aws from '@pulumi/aws';

const repository = new aws.ecr.Repository('actions-runner', {
  name: 'actions-runner',
  forceDelete: true,
});

new aws.ecs.Cluster('actions-runner', {
  name: 'actions-runner',
});

const role = new aws.iam.Role('actions-runner', {
  name: 'actions-runner@ecs',
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: 'ecs-tasks.amazonaws.com',
  }),
});

new aws.iam.RolePolicy('actions-runner', {
  role: role.name,
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['ssm:GetParameter'],
        Resource: 'arn:aws:ssm:*:*:parameter/github-app/*',
      },
      {
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:PutObject', 's3:ListObjectsV2'],
        // Resource: 'arn:aws:s3:::penxle-artifacts/actions-cache/*',
        Resource: '*',
      },
    ],
  },
});

new aws.ecs.TaskDefinition('actions-runner', {
  family: 'actions-runner',

  requiresCompatibilities: ['FARGATE'],
  networkMode: 'awsvpc',

  cpu: '4096',
  memory: '8192',

  executionRoleArn: bedrockRef('AWS_IAM_ROLE_ECS_EXECUTION_ARN'),
  taskRoleArn: role.arn,

  runtimePlatform: {
    cpuArchitecture: 'ARM64',
    operatingSystemFamily: 'LINUX',
  },

  containerDefinitions: repository.repositoryUrl.apply((url) =>
    JSON.stringify([
      {
        name: 'actions-runner',
        image: `${url}:latest`,

        essential: true,

        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-region': 'ap-northeast-2',
            'awslogs-group': '/aws/ecs/actions-runner',
            'awslogs-create-group': 'true',
            'awslogs-stream-prefix': 'container',
          },
        },
      },
    ]),
  ),
});