# Ciro Project - GitHub Deployment Guide

This document outlines the standardized process for managing GitHub deployments in this project, following CI/CD best practices.

## Branch Structure

We follow a structured branching model:

- `main` - Production-ready code
- `develop` - Integration branch for development
- `feature/name-of-feature` - Feature development branches
- `bugfix/issue-description` - Bug fix branches
- `hotfix/issue-description` - Urgent fixes for production

## Workflow

### Feature Development

1. Create a feature branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes, commit regularly:
   ```bash
   git add .
   git commit -m "Descriptive message about changes"
   ```

3. Push your feature branch:
   ```bash
   git push -u origin feature/your-feature-name
   ```

4. When feature is complete, create a Pull Request (PR) to merge into `develop`.
   - Request code reviews from team members
   - Address feedback and make necessary changes
   - Ensure tests pass

5. After approval, merge the PR into `develop`.

### Bug Fixes

1. Create a bugfix branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b bugfix/issue-description
   ```

2. Fix the bug, commit your changes:
   ```bash
   git add .
   git commit -m "Fix: Description of the bug fix"
   ```

3. Push your bugfix branch:
   ```bash
   git push -u origin bugfix/issue-description
   ```

4. Create a PR to merge into `develop`.
   - Follow code review process
   - Ensure tests pass

### Hotfixes

For critical issues that need to be fixed in production immediately:

1. Create a hotfix branch from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-issue-description
   ```

2. Make minimal changes to fix the issue:
   ```bash
   git add .
   git commit -m "Hotfix: Description of the critical fix"
   ```

3. Push your hotfix branch:
   ```bash
   git push -u origin hotfix/critical-issue-description
   ```

4. Create PRs to merge into both `main` AND `develop`.
   - This ensures the fix is in production AND incorporated into future releases

## Releases

1. When `develop` is stable and ready for release:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.x.x
   ```

2. Make any final version-specific changes:
   ```bash
   # Update version numbers, change logs, etc.
   git add .
   git commit -m "Prepare release v1.x.x"
   ```

3. Create PRs to merge into both `main` AND `develop`.

4. After merging to `main`, tag the release:
   ```bash
   git checkout main
   git pull origin main
   git tag -a v1.x.x -m "Release v1.x.x"
   git push origin v1.x.x
   ```

## Best Practices

1. **Never commit directly to `main` or `develop`** - Always use feature/bugfix/hotfix branches.

2. **Pull before you push** - Always sync with the remote before pushing changes.

3. **Write meaningful commit messages** - Describe what changed and why.

4. **Keep branches focused** - One feature or fix per branch.

5. **Delete branches after merging** - Keep the repository clean:
   ```bash
   # Delete local branch
   git branch -d feature/completed-feature
   
   # Delete remote branch
   git push origin --delete feature/completed-feature
   ```

6. **Use descriptive branch names** - Follow the naming convention consistently.

## CI/CD Integration

Our repository integrates with CI/CD pipelines that:

1. Run tests on all PRs
2. Build and deploy from `develop` to staging environments
3. Build and deploy from `main` to production environments

Always check the CI/CD status of your PR before merging.

## Troubleshooting

If you encounter issues with your deployment workflow:

1. Ensure your local repository is in sync with remote
2. Check for merge conflicts early and resolve them
3. Review CI/CD logs for any build or test failures
4. Reach out to the team for assistance with complex merges

## Additional Resources

- [GitHub Flow Documentation](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf) 