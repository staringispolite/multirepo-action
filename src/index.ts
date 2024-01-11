import * as core from '@actions/core';
import * as github from '@actions/github';
import { readdirSync } from 'fs';
import type { MintConfig } from '@mintlify/models';

try {
  const subdirectory = core.getInput('subdirectory');
  const targetBranch = core.getInput('target-branch');

  const dir = readdirSync(subdirectory);
  console.log(dir);

} catch (error) {
  const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : JSON.stringify(error, null, 2);
  core.setFailed(message);
}