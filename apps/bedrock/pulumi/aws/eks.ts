import * as aws from '@pulumi/aws';
import * as tls from '@pulumi/tls';
import { securityGroups, subnets } from '$aws/vpc';

const clusterRole = new aws.iam.Role('cluster@eks', {
  name: 'cluster@eks',
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: 'eks.amazonaws.com',
  }),
  managedPolicyArns: [aws.iam.ManagedPolicy.AmazonEKSClusterPolicy],
});

const fargateRole = new aws.iam.Role('fargate@eks', {
  name: 'fargate@eks',
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: 'eks-fargate-pods.amazonaws.com',
  }),
  managedPolicyArns: [aws.iam.ManagedPolicy.AmazonEKSFargatePodExecutionRolePolicy],
});

new aws.iam.Role('admin@eks', {
  name: 'admin@eks',
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    AWS: 'arn:aws:iam::721144421085:root',
  }),
});

export const cluster = new aws.eks.Cluster('penxle', {
  name: 'penxle',

  roleArn: clusterRole.arn,

  vpcConfig: {
    subnetIds: [subnets.public.az1.id, subnets.public.az2.id, subnets.private.az1.id, subnets.private.az2.id],
    securityGroupIds: [securityGroups.internal.id],
    endpointPublicAccess: false,
    endpointPrivateAccess: true,
  },

  kubernetesNetworkConfig: {
    serviceIpv4Cidr: '10.64.0.0/16',
  },
});

new aws.eks.Addon('aws-ebs-csi-driver', {
  clusterName: cluster.name,
  addonName: 'aws-ebs-csi-driver',
  addonVersion: aws.eks.getAddonVersionOutput({
    addonName: 'aws-ebs-csi-driver',
    kubernetesVersion: cluster.version,
    mostRecent: true,
  }).version,
});

new aws.eks.Addon('coredns', {
  clusterName: cluster.name,
  addonName: 'coredns',
  addonVersion: aws.eks.getAddonVersionOutput({
    addonName: 'coredns',
    kubernetesVersion: cluster.version,
    mostRecent: true,
  }).version,
});

new aws.eks.Addon('kube-proxy', {
  clusterName: cluster.name,
  addonName: 'kube-proxy',
  addonVersion: aws.eks.getAddonVersionOutput({
    addonName: 'kube-proxy',
    kubernetesVersion: cluster.version,
    mostRecent: true,
  }).version,
});

new aws.eks.Addon('vpc-cni', {
  clusterName: cluster.name,
  addonName: 'vpc-cni',
  addonVersion: aws.eks.getAddonVersionOutput({
    addonName: 'vpc-cni',
    kubernetesVersion: cluster.version,
    mostRecent: true,
  }).version,
});

export const fargate = new aws.eks.FargateProfile('karpenter', {
  fargateProfileName: 'karpenter',

  clusterName: cluster.name,
  podExecutionRoleArn: fargateRole.arn,

  selectors: [{ namespace: 'kube-system', labels: { app: 'karpenter' } }],
  subnetIds: [subnets.private.az1.id, subnets.private.az2.id],
});

const certificate = tls.getCertificateOutput({
  url: cluster.identities[0].oidcs[0].issuer,
});

export const oidcProvider = new aws.iam.OpenIdConnectProvider('cluster@eks', {
  url: cluster.identities[0].oidcs[0].issuer,
  clientIdLists: ['sts.amazonaws.com'],
  thumbprintLists: [certificate.certificates[0].sha1Fingerprint],
});

export const outputs = {
  AWS_EKS_CLUSTER_OIDC_PROVIDER_ARN: oidcProvider.arn,
  AWS_EKS_CLUSTER_OIDC_PROVIDER_URL: oidcProvider.url,
};
