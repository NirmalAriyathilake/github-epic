import * as core from '@actions/core';
import * as github from '@actions/github';

const count = (str, pattern) => {
  return ((str || '').match(pattern) || []).length;
}

async function getReferencedEpics({ octokit }) {
  console.log("Getting Referenced Epics");
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
  console.log("Updating Epic");
  const autoCloseEpic = core.getInput('close-epic', { required: true });
  const autoRemoveDeletedIssue = core.getInput('remove-deleted-issue', { required: true });
  let allIssuesClosed = false;

  // Get epic details
  const epicNumber = epic.source.issue.number;
  let epicBody = epic.source.issue.body;

  console.log("Selected Epic Number:" + epicNumber);

  // Get Issue details
  const selectedIssue = github.context.payload.issue;

  console.log("Selected issue :" + selectedIssue);

  if(selectedIssue != null){
    const issueNumber = selectedIssue.number;
    const issueState = selectedIssue.state;
    const convertedIssueState = issueState === 'closed' ? 'x' : ' ';

    const pattern = new RegExp(`- \\[[ |x]\\] .*#${issueNumber}.*`, 'gm');
    const matches = epicBody.matchAll(pattern);

    // eslint-disable-next-line no-restricted-syntax
    for (const match of matches) {
      epicBody = epicBody.replace(match[0], match[0].replace(/- \[[ |x]\]/, `- [${convertedIssueState}]`));
    }

    console.log("Issue updated");

    if (autoCloseEpic) {
      // all issues
      const allPattern = new RegExp(`- \\[[ |x]\\] .*#[0-9]+.*`, 'gm');
      const allIssueCount = count(epicBody, allPattern);

      console.log("No of issues in epic: " + allIssueCount);

      // closed issues
      const closedPattern = new RegExp(`- \\[[x]\\] .*#[0-9]+.*`, 'gm');
      const closedIssueCount = count(epicBody, closedPattern);

      console.log("No of closed issues in epic: " + closedIssueCount);

      allIssuesClosed = allIssueCount === closedIssueCount;

      console.log("All issues closed : " + allIssuesClosed);
    }
  }else{
    console.log("Issue not found");
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
  console.log("Updating Individual Epic");
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
