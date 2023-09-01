import { octokit } from '../octokit';
import { webhook } from '../webhook';

webhook.on('pull_request.opened', async (event) => {
  const sites = [
    'penxle.com',
    'penxle.io',
    'help.penxle.com',
    'landing.penxle.com',
  ];

  const table = sites.map((site) => {
    const subdomain = `pr-${
      event.payload.pull_request.number
    }-${site.replaceAll('.', '-')}`;
    return `| ${site} | https://${subdomain}.pnxl.site |`;
  });

  await octokit.request(
    'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
    {
      owner: event.payload.repository.owner.login,
      repo: event.payload.repository.name,
      issue_number: event.payload.pull_request.number,
      body: `
배포가 끝나면 아래 주소에서 프리뷰를 확인할 수 있어요.

| 프로젝트 | 프리뷰 URL |
| --- | --- |
${table.join('\n')}
`.trim(),
    },
  );
});