import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import { writeFile, readFile } from 'fs/promises';
import { parse } from 'yaml';
import type { MintConfig, Navigation, NavigationEntry } from '@mintlify/models';
import path from 'path';

type Repo = {
  owner: string;
  repo: string;
  ref?: string;
}

const execOrThrow: (...args: Parameters<typeof exec.exec>) => Promise<void> = async (...args) => {
  const exitCode = await exec.exec(...args);
  if (exitCode !== 0) throw Error(`error running command: ${args[0]} ${args[1]?.join(' ') ?? ''}`);
}

const setToken = async (token: string) => {
  const encodedToken = Buffer.from(`x-access-token:${token}`, 'utf-8').toString('base64');
  core.setSecret(encodedToken);
  const headerPlaceholder = 'Authorization: basic ***';
  const headerValue = `Authorization: basic ${encodedToken}`;
  const headerKey = 'http.https://github.com/.extraheader';
  const configPath = '.git/config';

  await execOrThrow('git', ['config', '--local', headerKey, headerPlaceholder]);
  const configString = await readFile(configPath, 'utf-8');
  await writeFile(configPath, configString.replace(headerPlaceholder, headerValue));

  return () => execOrThrow('git', ['config', '--local', '--unset-all', headerKey]);
}

const prependPrefix = (nav: NavigationEntry[], prefix: string): NavigationEntry[] => {
  return nav.map((entry) => (
    typeof entry === 'string'
      ? `${prefix}/${entry}`
      : {
          ...entry,
          pages: prependPrefix(entry.pages, prefix)
        }
  ))
};

const mergeNavigation = (main: Navigation, sub: Navigation, prefix: string) => {
  return [...main, ...prependPrefix(sub, prefix)];
}

let resetToken;
try {
  const token = core.getInput('token');
  const repos = parse(core.getInput('repos')) as Repo[];
  const targetBranch = core.getInput('target-branch');
  const subdirectory = core.getInput('subdirectory');
  const force = core.getBooleanInput('force');

  process.chdir(subdirectory);

  await execOrThrow('git', ['fetch', '-u', 'origin', `${targetBranch}:${targetBranch}`])
  await execOrThrow('git', ['symbolic-ref', 'HEAD', `refs/heads/${targetBranch}`]);

  const mainConfig = JSON.parse(await readFile('mint.json', 'utf-8')) as MintConfig;

  resetToken = await setToken(token);
  for (const { owner, repo, ref } of repos) {
    await io.rmRF(repo);

    const args = ['clone', '--depth=1'];
    if (ref) args.push('--branch', ref);
    args.push(`https://github.com/${owner}/${repo}`);

    await execOrThrow('git', args);
    await io.rmRF(`${repo}/.git`);

    const subConfig = JSON.parse(await readFile(path.join(repo, 'mint.json'), 'utf-8')) as MintConfig;
    mergeNavigation(mainConfig.navigation, subConfig.navigation, repo);
  }

  await writeFile('mint.json', JSON.stringify(mainConfig, null, 2));

  await execOrThrow('git', ['add', '.']);
  try {
    await exec.exec('git', ['diff-index', '--quiet', '--cached', 'HEAD', '--']) !== 0;
    console.log('No changes detected, skipping...');
  } catch {
    await execOrThrow('git', ['config', 'user.name', 'Mintie Bot']);
    await execOrThrow('git', ['config', 'user.email', 'aws@mintlify.com']);
    await execOrThrow('git', ['commit', '-m', 'update']);

    const pushArgs = ['push'];
    if (force) pushArgs.push('--force');
    pushArgs.push('origin', targetBranch);
    await execOrThrow('git', pushArgs);
  }
} catch (error) {
  const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : JSON.stringify(error, null, 2);
  core.setFailed(message);
} finally {
  resetToken?.();
}