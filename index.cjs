/* eslint-disable */
/**
 * Yarn Berry plugin that restores npm-style pre/post lifecycle hooks.
 *
 * Yarn Berry intentionally dropped automatic pre<script>/post<script> execution.
 * This plugin re-enables it by intercepting `yarn run <scriptName>` via the
 * `wrapScriptExecution` hook.
 *
 * Behaviour:
 *   1. Before the main script runs, if `pre<scriptName>` exists it is executed.
 *   2. After the main script succeeds, if `post<scriptName>` exists it is executed.
 *   3. CLI arguments are forwarded ONLY to the main script (pre/post get none).
 *   4. Built-in lifecycle scripts that Yarn already handles (preinstall, postinstall,
 *      prepublish, etc.) are skipped so we don't double-fire them.
 *   5. If the pre-script or main script fails (non-zero exit), execution stops
 *      and the exit code is propagated.
 */
module.exports = {
  name: 'plugin-lifecycle',
  factory: (require) => {
    const { scriptUtils } = require('@yarnpkg/core');

    // Scripts that Yarn Berry already runs automatically as lifecycle hooks.
    // We must NOT re-run these to avoid double execution.
    const BUILTIN_LIFECYCLE_SCRIPTS = new Set([
      'preinstall',
      'postinstall',
      'prepublish',
      'preprepare',
      'postprepare',
      'prepack',
      'postpack',
    ]);

    // Guard against infinite recursion: when we call executeWorkspaceScript for
    // a pre/post hook, that call itself goes through wrapScriptExecution again.
    // We use a Set of "locator#scriptName" keys to track scripts we are
    // currently running as lifecycle hooks so we don't try to run
    // pre-pre<scriptName> etc.
    const activeLifecycleScripts = new Set();

    return {
      hooks: {
        wrapScriptExecution(executor, project, locator, scriptName, extra) {
          return async () => {
            // Derive the pre/post names.  Works for colon-separated names too,
            // e.g. "my:task" → "premy:task" / "postmy:task"
            const preScriptName = `pre${scriptName}`;
            const postScriptName = `post${scriptName}`;

            // Skip if this script IS a built-in lifecycle hook.
            if (BUILTIN_LIFECYCLE_SCRIPTS.has(scriptName)) {
              return executor();
            }

            // Skip if we are already inside a lifecycle invocation for this
            // locator+script to prevent infinite recursion (e.g. running
            // "prefoo" would otherwise look for "preprefoo").
            const locatorKey = `${locator.locatorHash}#${scriptName}`;
            if (activeLifecycleScripts.has(locatorKey)) {
              return executor();
            }

            // Resolve the workspace so we can inspect its manifest scripts.
            const workspace = project.getWorkspaceByLocator(locator);

            // --- pre-script ---
            if (
              workspace.manifest.scripts.has(preScriptName) &&
              !BUILTIN_LIFECYCLE_SCRIPTS.has(preScriptName)
            ) {
              const preKey = `${locator.locatorHash}#${preScriptName}`;
              activeLifecycleScripts.add(preKey);
              try {
                const preExitCode = await scriptUtils.executeWorkspaceScript(
                  workspace,
                  preScriptName,
                  [],
                  { cwd: extra.cwd, stdin: extra.stdin, stdout: extra.stdout, stderr: extra.stderr },
                );
                if (preExitCode !== 0) {
                  return preExitCode;
                }
              } finally {
                activeLifecycleScripts.delete(preKey);
              }
            }

            // --- main script ---
            const mainExitCode = await executor();
            if (mainExitCode !== 0) {
              return mainExitCode;
            }

            // --- post-script ---
            if (
              workspace.manifest.scripts.has(postScriptName) &&
              !BUILTIN_LIFECYCLE_SCRIPTS.has(postScriptName)
            ) {
              const postKey = `${locator.locatorHash}#${postScriptName}`;
              activeLifecycleScripts.add(postKey);
              try {
                const postExitCode = await scriptUtils.executeWorkspaceScript(
                  workspace,
                  postScriptName,
                  [],
                  { cwd: extra.cwd, stdin: extra.stdin, stdout: extra.stdout, stderr: extra.stderr },
                );
                if (postExitCode !== 0) {
                  return postExitCode;
                }
              } finally {
                activeLifecycleScripts.delete(postKey);
              }
            }

            return mainExitCode;
          };
        },
      },
    };
  },
};
