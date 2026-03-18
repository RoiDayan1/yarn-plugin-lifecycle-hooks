# yarn-plugin-lifecycle-hooks

Yarn Berry plugin that restores npm-style `pre<script>` and `post<script>` lifecycle hooks.

Yarn Berry (v2+) intentionally dropped automatic execution of pre/post scripts. This plugin brings them back.

## Install

### From GitHub (recommended)

```sh
yarn plugin import https://raw.githubusercontent.com/roid/yarn-plugin-lifecycle-hooks/main/plugin-lifecycle.cjs
```

This downloads the plugin into `.yarn/plugins/` and updates `.yarnrc.yml` automatically.

### From a local file

```sh
yarn plugin import ./plugin-lifecycle.cjs
```

## Usage

Once installed, define `pre<script>` and `post<script>` entries in your `package.json` and they will run automatically:

```json
{
  "scripts": {
    "prebuild": "echo 'before build'",
    "build": "tsc",
    "postbuild": "echo 'after build'",
    "pretest": "echo 'before test'",
    "test": "jest",
    "posttest": "echo 'after test'"
  }
}
```

```sh
yarn build
# Runs: prebuild → build → postbuild

yarn test
# Runs: pretest → test → posttest
```

## How it works

- Before the main script runs, if `pre<scriptName>` exists in `package.json`, it is executed.
- After the main script succeeds, if `post<scriptName>` exists, it is executed.
- CLI arguments are forwarded **only** to the main script — pre/post hooks receive no arguments.
- If a pre-script or the main script fails (non-zero exit), execution stops and the exit code is propagated.
- Built-in lifecycle scripts that Yarn already handles (`preinstall`, `postinstall`, `prepublish`, etc.) are skipped to avoid double-firing.
- Works with colon-separated script names too (e.g. `premy:task` / `postmy:task`).

## Uninstall

Remove the plugin entry from `.yarnrc.yml` and delete the file from `.yarn/plugins/`.

## License

MIT
