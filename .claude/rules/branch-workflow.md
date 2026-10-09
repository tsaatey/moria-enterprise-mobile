# Branch Workflow Rules

`development`, `main`, and `staging` are protected: never commit or edit
directly on them. They move only through merged pull requests.

## The cycle

1. Check out a new branch — always from `main` (`git checkout main && git
   checkout -b <type>/<name>`). Never branch from `development` or `staging`.
2. Do the work and commit on that branch.
3. Open a PR from the branch onto `development` and merge it once it is
   ready (checks green, no conflicts) — do not leave it hanging.
4. Then open a PR from `development` onto `main` and merge it too, so
   `main` always carries what `development` has and stays a current base
   for the next branch.
5. Check out the next feature branch from `main` — and the circle
   continues: feature branch → `development` → `main` → new feature branch.

## If changes were accidentally committed to a protected branch

Move them to a branch instead of pushing: create a branch at the current
HEAD (this captures the commits), hard-reset the protected branch back to
its origin counterpart, then continue the cycle from step 3.
