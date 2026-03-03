import chalk from 'chalk';
import ora, { type Ora } from 'ora';

let verboseEnabled = false;
let silentMode = false;

export function setVerbose(v: boolean): void {
  verboseEnabled = v;
}

export function setSilent(s: boolean): void {
  silentMode = s;
}

export const log = {
  info(msg: string): void {
    if (silentMode) return;
    console.log(chalk.blue('ℹ'), msg);
  },
  success(msg: string): void {
    if (silentMode) return;
    console.log(chalk.green('✔'), msg);
  },
  warn(msg: string): void {
    if (silentMode) return;
    console.log(chalk.yellow('⚠'), msg);
  },
  error(msg: string): void {
    console.error(chalk.red('✖'), msg);
  },
  debug(msg: string): void {
    if (!verboseEnabled || silentMode) return;
    console.log(chalk.gray('  [debug]'), msg);
  },
  dim(msg: string): void {
    if (silentMode) return;
    console.log(chalk.dim(msg));
  },
};

export function spinner(text: string): Ora {
  if (silentMode) {
    // return a no-op spinner in silent mode
    return ora({ text, isSilent: true });
  }
  return ora({ text, color: 'cyan' });
}
