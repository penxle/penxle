import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

const bucket = new aws.s3.Bucket('cloudtrail', {
  bucket: 'penxle-cloudtrail',

  lifecycleRules: [{ enabled: true, expiration: { days: 365 } }],
});

const policy = new aws.s3.BucketPolicy('cloudtrail', {
  bucket: bucket.bucket,
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'cloudtrail.amazonaws.com' },
        Action: ['s3:GetBucketAcl', 's3:PutObject'],
        Resource: [bucket.arn, pulumi.interpolate`${bucket.arn}/*`],
      },
    ],
  },
});

const accessAnalyzer = new aws.iam.Role('access-analyzer@aws', {
  name: 'access-analyzer@aws',
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: 'access-analyzer.amazonaws.com',
  }),
});

new aws.iam.RolePolicy('access-analyzer@aws', {
  role: accessAnalyzer.name,
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: 'cloudtrail:GetTrail',
        Resource: '*',
      },
      {
        Effect: 'Allow',
        Action: ['iam:GenerateServiceLastAccessedDetails', 'iam:GetServiceLastAccessedDetails'],
        Resource: '*',
      },
      {
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:ListBucket'],
        Resource: [bucket.arn, pulumi.interpolate`${bucket.arn}/*`],
      },
    ],
  },
});

new aws.cloudtrail.Trail(
  'management-events',
  {
    name: 'management-events',

    s3BucketName: bucket.bucket,

    enableLogFileValidation: true,
    isMultiRegionTrail: true,
  },
  { dependsOn: [policy] },
);
