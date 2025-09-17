---
name: publish
description: Bump version, publish to npm, and push to git
---

# Publish Command

This command handles the complete release process for the nextjs-nango-plugin package.

## What it does:
1. Determines the version bump type (patch, minor, major) based on changes
2. Updates version in package.json
3. Updates version in llm.txt documentation
4. Builds the package
5. Publishes to npm
6. Commits the changes
8. Pushes to the remote repository
