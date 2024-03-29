import * as penxle from '@penxle/pulumi/components';
import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config('penxle');

const site = new penxle.Site('help.penxle.com', {
  name: 'help',

  domain: {
    production: 'help.penxle.com',
  },

  image: {
    name: '721144421085.dkr.ecr.ap-northeast-2.amazonaws.com/help.penxle.com',
    digest: config.require('image.digest'),
  },

  resources: {
    cpu: '100m',
    memory: '100Mi',
  },
});

export const SITE_URL = site.url;
