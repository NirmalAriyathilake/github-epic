import * as core from '@actions/core';
import * as github from '@actions/github';

async function getReferencedEpics({ octokit }) {
  const epicLabelName = core.getInput('epic-label-name', { required: true });

  const events = await octokit.issues.listEventsForTimeline({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: github.context.payload.issue.number,
  });

  const referencedEpics = events.data
    .filter((item) => (item.event === 'cross-referenced' && item.source))
    .filter((item) => item.source.issue.labels
      .filter((label) => label.name.toLowerCase() === epicLabelName.toLowerCase()).length > 0);

  return referencedEpics;
}

async function updateEpic({ octokit, epic }) {
  const autoCloseEpic = core.getInput('auto-close-epic', { required: true });
  let allIssuesClosed = false;

  const issueNumber = github.context.payload.issue.number;
  const issueState = github.context.payload.issue.state;
  const convertedIssueState = issueState === 'closed' ? 'x' : ' ';
  const epicNumber = epic.source.issue.number;
  let epicBody = epic.source.issue.body;

  const pattern = new RegExp(`- \\[[ |x]\\] .*#${issueNumber}.*`, 'gm');
  const matches = epicBody.matchAll(pattern);

  // eslint-disable-next-line no-restricted-syntax
  for (const match of matches) {
    epicBody = epicBody.replace(match[0], match[0].replace(/- \[[ |x]\]/, `- [${convertedIssueState}]`));
  }

  console.log("Issue updated");

  if (autoCloseEpic){
    // all issues
    const allPattern = new RegExp(`- \\[[ |x]\\] .*#\d.*`, 'gm');
    const allIssues = epicBody.matchAll(allPattern);

    console.log("No of issues in epic: " + allIssues.length);
    
    // closed issues
    const closedPattern = new RegExp(`- \\[[x]\\] .*#\d.*`, 'gm');
    const closedIssues = epicBody.matchAll(closedPattern);

    console.log("No of closed issues in epic: " + closedIssues.length);

    allIssuesClosed = allIssues.length === closedIssues.length;

    console.log("All issues closed : " + allIssuesClosed);
  }

  const result = await octokit.issues.update({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: epicNumber,
    body: epicBody,
    state: allIssuesClosed && autoCloseEpic ? 'closed' : 'open',
  });

  return result;
}

async function updateEpics({ octokit, epics }) {
  return Promise.all(epics.map((epic) => updateEpic({ octokit, epic })));
}

async function run() {
  try {
    const token = core.getInput('github-token', { required: true });

    const octokit = new github.GitHub(token, {
      previews: ['mockingbird-preview'],
    });

    const epics = await getReferencedEpics({ octokit });
    await updateEpics({ octokit, epics });
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

run();
