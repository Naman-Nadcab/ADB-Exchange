# Cursor-native frontend-only deploy

GitHub Actions can deploy the customer frontend through `.github/workflows/deploy-frontend-only.yml`. The Cursor Cloud Agent GitHub integration cannot start that workflow: `workflow_dispatch` returns HTTP 403 `Resource not accessible by integration`. The existing workflow stays in place. This document is the path a Cursor session uses when an authorized SSH private key is available on that session.

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
