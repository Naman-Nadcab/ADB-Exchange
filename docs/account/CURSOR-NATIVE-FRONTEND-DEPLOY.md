# Cursor-native frontend-only deploy

GitHub Actions deploys the customer frontend through `.github/workflows/deploy-frontend-only.yml`. The Cursor Cloud Agent GitHub integration cannot start that workflow with `workflow_dispatch`: the call returns HTTP 403 `Resource not accessible by integration`. Do not retry that call.

Cursor starts a deployment by pushing one lightweight tag. GitHub Actions then runs on a hosted runner and reads `VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER`, and `VPS_DEPLOY_PATH` from the `production` environment. The private key stays in that environment. It is not copied to the Cursor VM or into Git.

## Deployment-request tag

The tag name is exactly:

```text
frontend-deploy/<release-sha>/<expected-production-sha>
```

Both values are the full 40-character lowercase commit IDs. The tag must point at `<release-sha>`. Example:

```text
frontend-deploy/1591905dc047f397a2e764ee81dbeb1a42c6b8d5/4bb8e42a1772e45fcd16bfe8e072accd863cc7d4
```

The release commit does not contain `.github/workflows/deploy-frontend-only.yml`. GitHub Actions loads a workflow from the tagged commit, so pushing only `frontend-deploy/...` does not start a run. That was observed: the tag at `1591905dc047f397a2e764ee81dbeb1a42c6b8d5` created no workflow run, while creating the branch that contains this file did (`create` run `38389558142`, jobs skipped).

The command therefore also pushes:

```text
frontend-deploy-run/<release-sha>/<expected-production-sha>
```

That tag points at the current tip of `release/exchange-production-baseline`, the commit that contains this workflow. The workflow starts only for that tag prefix. It refuses to continue unless `frontend-deploy/<release-sha>/<expected-production-sha>` still peels to the release commit, and unless the run tag itself is the default-branch tip. Ordinary branch pushes, other tags, and `production.yml` do not deploy the frontend.

Before any production change, the same preflight, host-key, tree-status, bundle, and remote scripts reject the request when any of these are true:

- The tag name is malformed, or either SHA is not 40 lowercase hex characters.
- The tag does not peel to the release SHA named in the tag.
- The release is not a descendant of the expected production SHA.
- The diff touches anything outside `apps/frontend/`.
- The live production HEAD is not the expected SHA.
- The live tree is not `clean` or `clean_except_valid_deploy_marker`.
- The ED25519 host key does not match `SHA256:LPQv0Wf2i7YpOkuz+UBDw0U244tU/NumiDo4v7zuHGc`.
- `deployment/frontend-only-remote.sh` no longer contains the frontend rollback procedure.
- `PUBLIC_API_URL` or `PUBLIC_WS_URL` is empty, a placeholder (`api.example.com`, `CHANGE_ME`, `localhost`), or its host is not the production edge `169.58.39.2`. `http` and `ws` are accepted for that host because Nginx terminates TLS and the browser uses same-origin when the hosts match.

The remote script rebuilds only the frontend service (`docker compose up -d --build --no-deps frontend`). It does not run migrations or restart the other services. On a failed rebuild it restores the previous frontend image.

Create and push the tag only after those local checks pass:

```sh
EXPECTED_SHA=<current-production-head> \
RELEASE_SHA=<frontend-only-descendant> \
FRONTEND_DEPLOY_PUSH=1 \
  sh deployment/cursor-frontend-deploy.sh request
```

Omit `FRONTEND_DEPLOY_PUSH=1` to create the local tag without pushing it. The command does not need `VPS_SSH_KEY_PATH`.

## Who may push a deployment tag

This repository currently has no rulesets, and the `production` environment has no required reviewers. Anyone who can push a tag can therefore start a frontend deploy if the release still passes the checks above. That is the explicit deployment request; adding required reviewers on `production` would bring back a manual approval click.

Add a repository ruleset before relying on this in a wider team:

- Target `refs/tags/frontend-deploy/**` and `refs/tags/frontend-deploy-run/**`.
- Allow creation only for maintainers who are supposed to deploy.
- Block force-updates and deletion of those tags.
- Do not grant that bypass to the GitHub App identities that should not deploy.

The full-stack workflow remains limited to pushes of `main` and its own manual dispatch. It has no `frontend-deploy` trigger.

## SSH entry point

The script below is the path a Cursor session uses when an authorized SSH private key is already available on that session. A Cloud Agent VM does not keep `~/.ssh` across replacement. This VM has no deploy private key, so deploy, inspect, and rollback stop with `SSH_KEY_MISSING` before login. Use the tag above instead.

The entry point is `deployment/cursor-frontend-deploy.sh`. It calls the same host-key, tree-status, preflight, bundle, and remote scripts as the workflow. It does not run database migrations or the full-stack production workflow.

## Required access

- `VPS_HOST`: production host, currently `169.58.39.2`.
- `VPS_USER`: SSH user, currently `root`.
- `VPS_SSH_KEY_PATH`: path to an existing private key file outside the repository. Mode `600` or `400`. The key is not stored in Git.
- Optional `VPS_APP`: application directory. Empty means `/opt/adb-exchange`.

The session must be able to read that key file. A Cloud Agent VM does not keep `~/.ssh` across replacement. This VM currently has no deploy private key, so the script stops with `SSH_KEY_MISSING` before it logs in.

Host-key trust is not optional. Before login, `deployment/frontend-only-hostkey.sh` accepts only the ED25519 key whose fingerprint is `SHA256:LPQv0Wf2i7YpOkuz+UBDw0U244tU/NumiDo4v7zuHGc`. SSH then uses `StrictHostKeyChecking=yes`, `HostKeyAlgorithms=ssh-ed25519`, and that known_hosts file.

## Commands

Inspect:

```sh
VPS_HOST=169.58.39.2 \
VPS_USER=root \
VPS_SSH_KEY_PATH=/path/outside/the/repo/key \
  sh deployment/cursor-frontend-deploy.sh inspect
```

Deploy one already reviewed frontend release:

```sh
VPS_HOST=169.58.39.2 \
VPS_USER=root \
VPS_SSH_KEY_PATH=/path/outside/the/repo/key \
EXPECTED_SHA=<current-production-head> \
RELEASE_SHA=<frontend-only-descendant> \
  sh deployment/cursor-frontend-deploy.sh deploy
```

Roll back only the frontend container, using the record written by the last frontend-only deploy:

```sh
VPS_HOST=169.58.39.2 \
VPS_USER=root \
VPS_SSH_KEY_PATH=/path/outside/the/repo/key \
  sh deployment/cursor-frontend-deploy.sh rollback
```

## Stop conditions

Deploy does not continue when any of these are true:

- The private key file is missing, is a symlink, is not mode `600` or `400`, or is not an OpenSSH key.
- The live ED25519 host fingerprint differs from the pinned value.
- `deployment/frontend-only-preflight.sh` rejects the commit range. The release must be a descendant of the production HEAD and the diff must stay inside `apps/frontend/`.
- The live production HEAD is not the expected SHA.
- The live tree is anything other than `clean` or `clean_except_valid_deploy_marker`. The marker exception is only an unstaged `.deploy-rev` whose single line is the current HEAD.
- The git bundle tip is not the release commit.
- The remote frontend rebuild fails. `deployment/frontend-only-remote.sh` restores the previous frontend image on that failure.
- Public `https://<host>/login`, `/forex/account`, or `/health` fails after the rebuild. The script then runs frontend-only rollback.
- A post-deploy inspect shows that any container other than `exchange-frontend` changed its start time or image. The script then runs frontend-only rollback.

The script does not run `git reset`, `git clean`, or a full-stack Compose command. Rollback retags the saved frontend image and runs `docker compose up -d --no-deps --no-build frontend`.

## Result lines

A finished deploy prints `CURSOR_DEPLOY_OK`, `RELEASE_HEAD`, and `PREVIOUS_PRODUCTION_HEAD`. The remote script also prints `DEPLOY_OK` and `NEW_FRONTEND_IMAGE`. Inspect prints `PRODUCTION_HOSTNAME`, `PRODUCTION_HEAD`, `PRODUCTION_TREE_STATUS`, container lines, and `INSPECT_ONLY`.
