#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';

const program = new Command();

program
  .name('nextjs-nango-plugin')
  .description('CLI to set up Nango integration in Next.js apps')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize Nango plugin in your Next.js app and generate database migration')
  .action(initCommand);

program.parse();