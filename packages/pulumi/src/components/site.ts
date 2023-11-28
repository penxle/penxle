import * as aws from '@pulumi/aws';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DopplerSecret } from './doppler-secret';
import { IAMServiceAccount } from './iam-service-account';

type SiteArgs = {
  name: pulumi.Input<string>;
  domainName: pulumi.Input<string>;

  image: {
    name: pulumi.Input<string>;
    digest: pulumi.Input<string>;
  };

  resources: {
    cpu: pulumi.Input<string>;
    memory: pulumi.Input<string>;
  };

  iam?: {
    policy: pulumi.Input<aws.iam.PolicyDocument>;
  };

  secret?: {
    project: pulumi.Input<string>;
  };
};

export class Site extends pulumi.ComponentResource {
  public readonly url: pulumi.Output<string>;

  constructor(name: string, args: SiteArgs, opts?: pulumi.ComponentResourceOptions) {
    super('penxle:index:Site', name, {}, opts);

    const stack = pulumi.getStack();
    const isProd = stack === 'prod';

    const resourceName = isProd ? args.name : pulumi.interpolate`${args.name}-${stack}`;
    const domainName = isProd ? args.domainName : pulumi.interpolate`${args.name}-${stack}.pnxl.site`;
    this.url = pulumi.output(pulumi.interpolate`https://${domainName}`);

    const provider = new k8s.Provider(
      'yaml',
      { renderYamlToDirectory: pulumi.interpolate`manifests/${resourceName}` },
      { parent: this },
    );

    const namespace = isProd ? 'prod' : 'preview';

    let secret;
    if (args.secret) {
      secret = new DopplerSecret(
        name,
        {
          metadata: {
            name: resourceName,
            namespace,
          },
          spec: {
            project: args.secret.project,
            config: isProd ? 'prod' : 'preview',
          },
        },
        {
          parent: this,
          provider,
        },
      );
    }

    let serviceAccount;
    if (args.iam) {
      serviceAccount = new IAMServiceAccount(
        name,
        {
          metadata: {
            name: resourceName,
            namespace,
          },
          spec: {
            policy: args.iam.policy,
          },
        },
        {
          parent: this,
          provider,
        },
      );
    }

    const labels = { app: resourceName };

    const service = new k8s.core.v1.Service(
      name,
      {
        metadata: {
          name: resourceName,
          namespace,
        },
        spec: {
          type: 'NodePort',
          selector: labels,
          ports: [{ port: 3000 }],
        },
      },
      {
        parent: this,
        provider,
      },
    );

    const rollout = new k8s.apiextensions.CustomResource(
      name,
      {
        apiVersion: 'argoproj.io/v1alpha1',
        kind: 'Rollout',

        metadata: {
          name: resourceName,
          namespace,
        },
        spec: {
          selector: { matchLabels: labels },
          template: {
            metadata: { labels },
            spec: {
              ...(serviceAccount && { serviceAccountName: serviceAccount.metadata.name }),
              containers: [
                {
                  name: 'app',
                  image: pulumi.interpolate`${args.image.name}@${args.image.digest}`,
                  env: [
                    { name: 'HTTP_HOST', value: domainName },
                    { name: 'PUBLIC_PULUMI_STACK', value: stack },
                  ],
                  ...(secret && { envFrom: [{ secretRef: { name: secret.metadata.name } }] }),
                  resources: {
                    requests: { cpu: args.resources.cpu },
                    limits: { memory: args.resources.memory },
                  },
                },
              ],
            },
          },
          strategy: {
            blueGreen: {
              activeService: service.metadata.name,
            },
          },
        },
      },
      {
        parent: this,
        provider,
      },
    );

    new k8s.autoscaling.v2.HorizontalPodAutoscaler(
      name,
      {
        metadata: {
          name: resourceName,
          namespace,
        },
        spec: {
          scaleTargetRef: {
            apiVersion: rollout.apiVersion,
            kind: rollout.kind,
            name: rollout.metadata.name,
          },
          minReplicas: 2,
          maxReplicas: 100,
          metrics: [
            {
              type: 'Resource',
              resource: {
                name: 'cpu',
                target: { type: 'Utilization', averageUtilization: 50 },
              },
            },
          ],
        },
      },
      {
        parent: this,
        provider,
      },
    );

    new k8s.policy.v1.PodDisruptionBudget(
      name,
      {
        metadata: {
          name: resourceName,
          namespace,
        },
        spec: {
          selector: { matchLabels: labels },
          minAvailable: 1,
        },
      },
      {
        parent: this,
        provider,
      },
    );

    new k8s.networking.v1.Ingress(
      name,
      {
        metadata: {
          name: resourceName,
          namespace,
          annotations: {
            'alb.ingress.kubernetes.io/scheme': 'internet-facing',
            'alb.ingress.kubernetes.io/listen-ports': JSON.stringify([{ HTTP: 80, HTTPS: 443 }]),
            'alb.ingress.kubernetes.io/security-groups': 'internal, public-web',
            'alb.ingress.kubernetes.io/ssl-redirect': '443',
            ...(!isProd && { 'alb.ingress.kubernetes.io/group.name': 'penxle-preview' }),
            // 'alb.ingress.kubernetes.io/actions.www-redirect': JSON.stringify({
            //   Type: 'redirect',
            //   RedirectConfig: { Host: 'staging2.penxle.com', Port: '443', Protocol: 'HTTPS', StatusCode: 'HTTP_302' },
            // }),
          },
        },
        spec: {
          ingressClassName: 'alb',
          rules: [
            {
              host: domainName,
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: {
                        name: service.metadata.name,
                        port: { number: service.spec.ports[0].port },
                      },
                    },
                  },
                ],
              },
            },
            // {
            //   host: 'staging2.pnxl.co',
            //   http: {
            //     paths: [
            //       {
            //         path: '/',
            //         pathType: 'Prefix',
            //         backend: {
            //           service: {
            //             name: 'www-redirect',
            //             port: { name: 'use-annotation' },
            //           },
            //         },
            //       },
            //     ],
            //   },
            // },
          ],
        },
      },
      {
        parent: this,
        provider,
      },
    );
  }
}
