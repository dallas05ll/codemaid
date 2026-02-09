import ora, { type Ora } from 'ora';

let spinner: Ora | null = null;

export function start(text: string): void {
  spinner = ora({ text, color: 'cyan' }).start();
}

export function update(text: string): void {
  if (spinner) spinner.text = text;
}

export function succeed(text: string): void {
  if (spinner) spinner.succeed(text);
  spinner = null;
}

export function fail(text: string): void {
  if (spinner) spinner.fail(text);
  spinner = null;
}

export function stop(): void {
  if (spinner) spinner.stop();
  spinner = null;
}
