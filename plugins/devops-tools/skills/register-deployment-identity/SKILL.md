---
name: register-deployment-identity
description: >-
  Register Azure deployment identities for a GitHub repository in endjin's
  endjin/endjin-identity-ops repo: user-assigned managed identities that GitHub Actions
  uses through OIDC (federated credentials) to deploy to an environment such as dev, test
  or prod. Use this skill when the user asks for a deployment identity, deployment
  principal, service principal, managed identity, workload identity or federated
  credential for a repo's CI/CD, wants a GitHub Actions workflow to sign in to Azure
  without secrets, or wants to change the resource groups, roles or groups of an existing
  worker identity in endjin-identity-ops.
---

# Register a deployment identity

endjin's GitHub Actions workflows sign in to Azure as **worker identities**. A worker
identity is a user-assigned managed identity with a federated credential for each GitHub
environment it serves. You never create one by hand. You add a YAML file to the private
`endjin/endjin-identity-ops` repo, and its `identity-manager` workflow creates the identity
when the pull request (PR) merges.

The result of this skill is a PR in `endjin/endjin-identity-ops`. It also gives the user
the follow-up steps for the repo that will use the identities (the **consuming repo**).

This skill holds no subscription IDs, group names or other tenant details. Read them from
the endjin-identity-ops repo each time, because they change.

## Workflow

### 1. Get the endjin-identity-ops repo

Use a working tree that the user names, or clone `endjin/endjin-identity-ops`. Before you
start:

- Run `git status`. The user may have untracked or changed files there. Leave them alone,
  and never stage them.
- Update `main` from `origin`, and create a branch from it.
- Read `README.md`. It has the YAML schema and the list of subscriptions for each
  environment.
- Read every file under `identities/`. The existing entries are the best reference for
  subscription IDs (each has a comment with the subscription name), group names, role
  choices and naming.

### 2. Find out what the deployment needs

Read the consuming repo's deployment code: Bicep or ARM templates, deployment scripts,
environment configuration files and workflows. Find each of these:

| Fact | Where to look | Why it matters |
| --- | --- | --- |
| Environments, for example `dev` and `prod` | Environment config files, workflows | One identity for each environment |
| Subscription for each environment | Environment config, or ask the user | Decides the `nonprod` or `prod` folder |
| Resource group names and locations | Environment config, templates | The identity manager creates these groups |
| Role assignments created by the templates | `Microsoft.Authorization/roleAssignments` in templates | Contributor cannot create them |
| Container images pushed to a registry | Build or deploy scripts, workflows | Needs the ACR publishers group |
| Records written in a shared DNS zone | Templates, scripts | Needs a role on the DNS resource group |
| Microsoft Graph operations, for example creating Entra ID groups | Scripts | Needs Graph permissions set by hand |

If a fact is missing, for example the prod resource group has no name yet, propose a name
that follows the other environments, for example `rg-app-prod` after `rg-app-dev`. Tell the
user, because the consuming repo's config must use the same name.

Ask the user only for what the code cannot tell you, such as the subscription for an
environment that has no config yet.

### 3. Write the identity files

The folder decides which identity manager processes the file, and so which subscriptions
the identity can get access to:

- `identities/nonprod/<github-org>/<repo>.yml` for development and test subscriptions
- `identities/prod/<github-org>/<repo>.yml` for production subscriptions

So a repo with dev and prod environments needs **two files with the same name**, one in each
folder. Put all the identities of one repo and one folder in one file, as a YAML list.

Use the repo name in kebab case for the file name, for example `ip-maturity-matrix.yml` for
`Endjin.Ip.Maturity.Matrix`. Follow the existing files.

Each entry has this shape:

```yaml
- name: <repo-kebab>-<environment>
  description: Identity used to deploy the <environment> instance of <what the repo deploys>
  github:
    repoName: <github-org>/<RepoName>
    branches: []
    environments:
    - <github-environment-name>
  subscription:
    subscriptionId: <subscription-id>  # <subscription-name>
    managedResourceGroups:
    - name: <resource-group-name>
      location: <azure-region>
      roles:
      - Owner     # <why this role is needed>
  assignedAadGroups:
  - name: <cicd-readers-group-for-this-folder>
```

Rules for each field:

- **`name`**: the identity's name in Azure. Use `<repo-kebab>-<environment>`. It must be
  unique across both folders.
- **`github.repoName`**: write the repo name with the same case as on GitHub.
- **`github.environments`**: the GitHub Actions environment names the workflow will use.
  The identity manager adds a federated credential with the subject
  `repo:<org>/<repo>:environment:<name>` for each one. A workflow job can get a token only
  if it runs in one of these environments.
- **`github.branches`**: keep this as `[]`. A branch credential lets any workflow on that
  branch use the identity, with none of the protection rules of an environment.
- **`subscription.subscriptionId`**: copy the ID from an existing file in the same folder,
  with the subscription name as a comment. Never use a production subscription in the
  `nonprod` folder, or the reverse.
- **`managedResourceGroups`**: the identity manager creates each group if it does not exist,
  and assigns the roles to the identity on that group only. The identity gets no role on the
  subscription. So the deployment must deploy at resource group scope, and must not try to
  create its own resource group.
- **`roles`**: give the least that works.
  - `Owner` when the templates create role assignments, for example when a Function App
    gets a role on its storage account. This is what most existing entries use.
  - `Contributor` plus `Role Based Access Control Administrator` is a narrower choice for
    the same need.
  - `Contributor` when the templates create no role assignments.
  - `Contributor` on a shared resource group, such as the one that holds the DNS zones,
    when the deployment only adds records there. Copy the group name and location from an
    existing entry.

  Add a short comment that says why the identity needs each role that is not obvious.
- **`assignedAadGroups`**: copy the CI/CD readers group from an existing entry in the same
  folder. Add the ACR publishers group for the folder only if the deployment pushes
  container images. Add no other group unless the deployment needs it.

Some needs have no field, for example Microsoft Graph application permissions. Add a
comment such as `# TODO: Requires 'Group.Create' Graph permissions to be manually assigned`,
and tell the user that a tenant administrator must grant them.

### 4. Check the files

- Parse each file as YAML. If Python is not available, use PowerShell:
  `Import-Module powershell-yaml; ConvertFrom-Yaml (Get-Content -Raw <file>)`.
- Compare each entry with an existing entry, field by field.
- Check that every resource group name matches the consuming repo's config exactly.

### 5. Open the PR

- Stage only the new or changed identity files.
- Write a commit message and PR title such as
  `Add dev and prod identities for the <repo> deployment`.
- In the PR description, link the consuming repo or its PR, and give a table of each identity
  with its GitHub environment, subscription name and resource groups. Explain each role
  above Contributor and each group.

Review rules apply. CODEOWNERS requires named approvers for anything under
`identities/prod/`, so a prod identity waits for their approval. The repo allows only squash
merges.

### 6. Tell the user what happens next

After the PR merges, the `identity-manager-nonprod` or `identity-manager-prod` workflow runs
for the changed files. For each identity, it:

1. creates the managed identity and its federated credentials;
2. creates the resource groups and assigns the roles;
3. adds the identity to the groups;
4. **sets up the consuming repo**: it creates each GitHub environment, sets the
   `AZURE_CLIENT_ID` and `AZURE_SUBSCRIPTION_ID` variables on each environment, and sets
   the `AZURE_TENANT_ID` variable on the repo.

So the user does not create the environments or copy any IDs. The consuming repo still needs:

- **A deploy workflow** that uses the identity:

  ```yaml
  permissions:
    contents: read
    id-token: write

  jobs:
    deploy:
      runs-on: ubuntu-latest
      environment: dev
      steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
          enable-AzPSSession: true   # for Az PowerShell, for example a ZeroFailed deployment
  ```

- **Protection rules on the prod environment**, such as required reviewers or a deployment
  branch rule. Add them after the identity manager has created the environment.
- **Config that matches the identity files**: the same resource group names and
  subscriptions in each environment's configuration.

## Things that go wrong

- **The workflow cannot get a token.** The job has no `environment:`, uses an environment
  name that is not in the identity file, or has no `id-token: write` permission.
- **The deployment fails with AuthorizationFailed on the subscription.** It tries to create
  the resource group, or deploys at subscription scope. The identity has roles only on its
  managed resource groups.
- **A role assignment fails during deployment.** The identity has Contributor where the
  templates create role assignments.
- **The identity was not created after the merge.** The identity manager processes only the
  files that the merge commit changed. A maintainer can run the workflow by hand with
  `full_sync` or a different `base_ref`.
- **An identity is no longer needed.** The identity manager does not delete identities, role
  assignments or resource groups. Removing the file is not enough: ask a maintainer to remove
  the Azure resources.
