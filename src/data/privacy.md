devlanes is an open source program that runs on your computer. It has no accounts and keeps no user data on a server. This policy covers the devlanes program, its browser extension, its GitHub Action and the devlanes.run website. It is effective from 2026-11-28.

## The devlanes program

devlanes sends no telemetry, usage data or crash reports. It connects to the services in your own lanes and to the machines you add as remote boxes.

Its other requests are release checks. The daemon checks 30 seconds after it starts, then every 4 hours and when the TUI opens. It asks the source you installed devlanes from for the latest version.

- GitHub releases of devlanes-run/devlanes, for `install.sh`, `install.ps1` and cargo installs.
- `registry.npmjs.org`, for npm, pnpm, Bun and Yarn installs.
- `pypi.org`, for uv, pipx and pip installs.
- The Homebrew tap's formula on `raw.githubusercontent.com`, for Homebrew installs.

When a new version is out, devlanes also reads its release notes from `raw.githubusercontent.com`. Each check is a plain HTTPS request made with curl. It sends nothing about you or your projects, though the server sees your IP address as it does for any request. The answer is cached in the devlanes folder on your computer.

With `updates.mode: auto`, the default, devlanes installs patch releases in the background. A script install downloads the release from GitHub. A package manager install runs that package manager, which contacts its own registry.

Set `updates.mode: disable` in `~/.devlanes/config.yaml`, or set `DEVLANES_NO_UPDATE_CHECK=1`, to turn the checks off. They are also off in CI.

The install scripts at `devlanes.run/install.sh` and `devlanes.run/install.ps1` download the release files from GitHub.

When Claude shows the lane card that `devlanes mcp` returns, the card may load Claude's fonts from `assets.claude.ai`.

## The browser extension

The extension runs in Chrome, Brave, Edge and other Chromium browsers. It talks only to the devlanes program on your computer, through the browser's native messaging. It makes no network requests of its own. It has no analytics or telemetry, and it sends no data to devlanes-run or to anyone else.

It reads the URLs of `https://*.localhost` tabs to know which lane a tab shows. It doesn't read other tabs. The login fill reads form fields marked with the autocomplete tokens `username`, `email`, `current-password` and `new-password`, on `https://*.localhost` pages only.

From devlanes it receives projects, lanes, URLs, branch names, lane states and box names. It never receives environments, secrets or logs.

When "Remember passwords" is on and you sign in on a lane, the extension saves that username and password in `chrome.storage.local` in that browser. They are stored unencrypted, so use the fill for test accounts only. Nothing is synced. Settings also live in `chrome.storage.local`. Recent lane-switch notices live in `chrome.storage.session`, which the browser clears when it closes.

In the popup's settings you can turn off the fill and saved passwords, and delete a project's saved logins. Removing the extension deletes all of its stored data.

The extension's data is not sold or transferred. It is not used for anything outside the extension's purpose, and it is not used to decide credit or lending.

## The GitHub Action

devlanes-run/action downloads devlanes from GitHub releases. It reads the jobs of the current workflow run from the GitHub API with the job's token. When a job fails, it uploads the lane's logs as an artifact of that run in your repository.

## The devlanes.run website

Cloudflare serves the site. Every request reaches Cloudflare with your IP address, your browser's user agent and the page you ask for. Cloudflare handles it under the [Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/).

Each page loads a Plausible Analytics script from `metrics.arthur.one`. It reports page views, time on the page, scroll depth, outbound link clicks, file downloads and form submissions. Each report sends the event and the page address to `metrics.arthur.one`, with the referrer on page views. The request also carries your IP address and user agent. Blocking that address stops the analytics, and the site still works.

The home page asks `api.github.com` for the star count of devlanes-run/devlanes, so GitHub receives that request. The "Ask ChatGPT" and "Ask Claude" links on docs pages send the page's address to those services when you click them.

The fonts come from devlanes.run. The site sets no cookies. It keeps your theme and the tabs you pick in the docs in your browser's local storage.

## Changes

This policy's source is in [devlanes-run/website](https://github.com/devlanes-run/website). A change to the policy is a commit there and updates the effective date.

## Contact

Open an issue on the repository your question is about. [devlanes-run/devlanes](https://github.com/devlanes-run/devlanes/issues) covers the program, [devlanes-run/browser](https://github.com/devlanes-run/browser/issues) the extension, [devlanes-run/action](https://github.com/devlanes-run/action/issues) the GitHub Action and [devlanes-run/website](https://github.com/devlanes-run/website/issues) the website.
