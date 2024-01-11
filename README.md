# Mintlify Multirepo Action

This action compiles multiple GitHub repositories containing mintlify docs into a single repository.

## Inputs

### repos (required)

A stringified yaml array containing objects representing the mintlify docs repositories to be aggregated. These objects have the following properties:
- `owner`: **(required)** the owner/org of the repo
- `repo`: **(required)** the name of the repo
- `ref`: the branch/ref at which to check out the repository

### target-branch (required)

The branch to which the complete documentation will be pushed

### subdirectory

Path to the directory containing the main `mint.json`

### force

If `true`, will force-push to `target-branch`

## Example

```yaml
on: push

jobs:
  aggregate-docs:
    runs-on: ubuntu-latest
    name: Aggregate mintlify docs
    steps:
      - name: Clone repo
        uses: actions/checkout@v3
      - name: Run mintlify action
        uses: mintlify/mintlify-multirepo-action@v0.1
        with:
          repos: |
            - owner: mintlify
              repo: docs
            - owner: mintlify
              repo: additional-docs
              ref: v1.0.0
          target-branch: docs
          subdirectory: ./my-docs
```