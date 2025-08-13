# Contributor Guide

[![Project Version][version-image]][version-url]

# Welcome!

We're so glad you would want to come and contribute! We are a small team and we are always looking for help. There are multiple opportunities to contribute at all levels, be it in documentation or code. See a gas optimization, or a bug? We'd love to hear your take! This document will be the place to get you started. Please do not be intimidated by this as this is just a helpful guide to help you navigate the process.

## Asking For Help

If you have reviewed existing documentation and still have questions or are having problems, we are always a message away. You can reach out to the [Team](mailto:rules@thrackle.io). Opening an issue is also a great way to get help for particularly complex issues.

## Submitting a Bug Report

If you feel you have stumbled upon a particularly severe bug, please quietly message the [Team](mailto:rules@thrackle.io) as soon as possible and keep the bug report private so the incident response team can react accordingly. If you have found a bug that is not severe or an optimization potential, please open an issue on the repository, and (if possible) a PR with a solution, and a test to show the bug and the fix.

The most important pieces of information we need in a bug report are:

- A description of the bug
- The platform you are on
- Concrete steps to reproduce the bug
- Expected behavior
- Actual behavior
- Any error messages or logs
- Any other relevant information
- If possible, code snippets that demonstrate area where bug is occurring

## Reviewing pull requests

All contributors who choose to review and provide feedback on pull requests have a responsibility to both the project and individual making the contribution. Reviews and feedback must be helpful, insightful, and geared towards improving the contribution as opposed to simply blocking it. If there are reasons why you feel the PR should not be merged, explain what those are. Do not expect to be able to block a PR from advancing simply because you say "no" without giving an explanation. Be open to having your mind changed. Be open to working with the contributor to make the pull request better.

Reviews that are dismissive or disrespectful of the contributor or any other reviewers are strictly counter to the Code of Conduct.

When reviewing a pull request, the primary goals are for the codebase to improve and for the person submitting the request to succeed. Even if a pull request is not merged, the submitter should come away from the experience feeling like their effort was not unappreciated. Every PR from a new contributor is an opportunity to grow the community.

## Testing

All code changes should be accompanied by automated tests exercising the feature.

## Adding a new feature

Please ensure you make yourself familiar with the current architecture and best practices around working with that architecture. All new features should first go through a strenuous effort of having been tested on a local environment and verified by team members before being merged into a release. If you are adding a new feature, please ensure that you have added a new test to cover that feature.

## Branch names

If possible, please use JIRA to create new branch names. If you do not have access to the team JIRA, do not fret! Just come up with a decently descriptive name that tracks an issue in Github!

## Commits

Always make sure your commits messages are informative and describe the changes within the commit at a high level. In order to ensure that commits have a chronological sensibility, it may make sense to squash many commits together. In the case of potential merge conflicts, the preferred methodology to resolve said conflicts is to rebase against the trunk and make corrections along the way.

<!-- These are the header links -->

[version-image]: https://img.shields.io/badge/Version-2.4.0-brightgreen?style=for-the-badge&logo=appveyor
[version-url]: https://github.com/Forte-Service-Company-Ltd/forte-rules-engine-sdk
