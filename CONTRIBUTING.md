# DSEC Notebook Contributing Guide

## Welcome

Welcome to the DSEC Notebook Contributing Guide, and thank you for your interest.

DSEC Notebook is a centralised resource hub for Deakin University students studying SIT (IT, computer science, and cybersecurity) and Mathematics units. It is written by students, for students, and it is not affiliated with Deakin University.

If you would like to contribute, check out the types of contributions we accept and their corresponding sections in this guide:

- **Code contributions**
    - [Bug fixes](#report-issues-and-bugs)
    - [New features](#share-ideas)
    - [Tests](#best-practices)
- **Documentation and design**
    - [Documentation](#content-style-guide)
    - [UI/UX improvements](#content-style-guide)

However, at this time, we do not accept the following contributions:

- Breaking architectural changes (large rewrites without prior discussion)
- Out-of-scope tools (swapping the stack — SvelteKit, SQLite, or Tailwind — for alternatives)
- New dependencies without prior approval

## DSEC Notebook overview

The purpose of the DSEC Notebook is to provide students at Deakin University with resources which are lacked in their studies. Students can share study notes, ask questions, and browse content organised by unit and topic.

## Community engagement

Refer to the following channels to connect with fellow contributors or to stay up-to-date with news about the DSEC Notebook:

- Join our project contributors on [Discord](https://discord.dsec.club).

## Share ideas

To share your new ideas for the project, perform the following actions:

1. Search the [issue tracker](https://github.com/dsec-hub/dsec-notebook/issues) to see whether your idea has already been raised.
2. If not, [open a new issue](https://github.com/dsec-hub/dsec-notebook/issues/new) and describe the idea in detail.
3. Wait for a maintainer to discuss and confirm the idea before you start implementing it.

## Before you start

Before you start contributing, ensure you have the following:

- A [GitHub](https://github.com) account
- [Node.js](https://nodejs.org/) 24 or newer
- npm
- A `@deakin.edu.au` email address (required to create an account on the app itself)

## Environment setup

To set up your environment, perform the following actions:

1. Clone the repository and install dependencies:

    ```sh
    git clone https://github.com/dsec-hub/dsec-notebook.git
    cd dsec-notebook
    npm install
    ```

2. Configure environment variables:

    ```sh
    cp .env.example .env
    ```

    `DATABASE_PATH` defaults to `data/dsec.db`. To send verification emails during development, set `RESEND_API_KEY` (get one at <https://resend.com/api-keys>). Without it, email verification will fail.

3. Start the development server:

    ```sh
    npm run dev
    ```

4. Open the URL printed in the terminal (usually `http://localhost:5173`).

### Troubleshoot

If you encounter issues as you set up your environment, refer to the following:

- Windows: ensure Node.js 24 is installed and that `npm` is on your `PATH`. If `npm install` fails on native modules, enable Windows build tools (`npm install -g windows-build-tools`).
- macOS: install Node.js via [nvm](https://github.com/nvm-sh/nvm) or the [official installer](https://nodejs.org/) and restart your terminal before running `npm install`.
- Linux: install Node.js 24 using [nvm](https://github.com/nvm-sh/nvm). If you hit permission errors, avoid running npm with `sudo`.

## Best practices

Our project uses the following best practices for contributing:

- Run `npm run fmt:check`, `npm run lint`, and `npm run check` before submitting a pull request; the CI [checks workflow](.github/workflows/checks.yml) runs all three.
- Run `npm run fmt` and `npm run lint:fix` to auto-fix formatting and lint issues.
- Write tests for new functionality using [Vitest](https://vitest.dev/), and run `npm test` to verify they pass.
- Keep changes small and scoped to a single issue or feature.

## Content style guide

Read the [README](README.md) and the [Project structure](README.md#project-structure) section to understand how the project is organised. The purpose of our style guide is to ensure consistency in the tone, voice, and structure of our documentation and code.

## Contribution workflow

### Fork and clone repositories

1. Fork the repository by clicking **Fork** on <https://github.com/dsec-hub/dsec-notebook>.
2. Clone your fork:

    ```sh
    git clone https://github.com/<your-username>/dsec-notebook.git
    ```

3. Add the upstream remote so you can stay in sync:

    ```sh
    git remote add upstream https://github.com/dsec-hub/dsec-notebook.git
    ```

### Report issues and bugs

1. Check the [issue tracker](https://github.com/dsec-hub/dsec-notebook/issues) to avoid duplicates.
2. Open a new issue and include a clear title and a description of the bug.
3. Include steps to reproduce, expected vs actual behaviour, and any relevant screenshots or logs.

### Issue management

- Issues are labelled by maintainers (for example, `bug`, `enhancement`, or `documentation`).
- Comment on an issue before starting work so maintainers can assign it to you.
- Do not work on issues that are already assigned to someone else.

### Commit messages

Write commit messages in short, lowercase imperative sentences that describe the change, for example:

- `add units page`
- `fix vote count`
- `remove unused dev files`

### Branch creation

Create a branch from an up-to-date `main` using a `<type>/<description>` name in kebab-case, for example:

- `feature/units-page`
- `fix/login-error`
- `cleanup/remove-pwa-files`
- `docs/update-readme`

### Pull requests

1. Push your branch to your fork and open a pull request against `main`.
2. Fill in the pull request template, linking the issue it resolves.
3. Ensure all CI checks pass (`fmt:check`, `lint`, and `check`).
4. Request a review and respond to feedback until it is merged.

### Releases

Releases are deployed automatically to the live site by the [deploy workflow](.github/workflows/deploy.yml) when changes are merged to `main`. There is no separate versioned release process; merges to `main` are shipped continuously.

### Text formats

- Documentation and comments are written in Markdown or plain text.
- Code is formatted with [oxfmt](https://oxfmt.com) and linted with [oxlint](https://oxc.rs/docs/guide/usage/linter) — do not hand-format files; run `npm run fmt` before committing.

## License

DSEC Notebook is licensed under the [GNU General Public License v3.0](LICENSE). By contributing, you agree that your contributions will be licensed under its terms.
