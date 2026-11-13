<#
.SYNOPSIS
  Creates the GitHub repository for HexCoach from this local folder and pushes it.

.DESCRIPTION
  Requires an authenticated GitHub CLI. Run `gh auth login` once, then re-run this
  script. It initialises git if needed, creates the first commit, creates the
  repository on your account (if it does not exist yet) and pushes `main`.

.PARAMETER Name
  Repository name, optionally as `owner/name`. Defaults to "hexcoach".

.PARAMETER Visibility
  public or private. Defaults to public.

.PARAMETER Remote
  Git remote name. Defaults to origin.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/publish.ps1 -Name hexcoach -Visibility public
#>
[CmdletBinding()]
param(
  [string]$Name = "hexcoach",
  [ValidateSet("public", "private")]
  [string]$Visibility = "public",
  [string]$Remote = "origin"
)

# Native tools such as `gh` and `git` report failure through their exit code and
# stderr. With ErrorActionPreference = "Stop", Windows PowerShell turns that
# stderr into a terminating NativeCommandError (for example `gh repo view` on a
# repository that does not exist yet). Keep native failures non-terminating and
# verify $LASTEXITCODE explicitly after every call.
$ErrorActionPreference = "Continue"

# PowerShell 7.3+ can turn a native command's non-zero exit code into a
# terminating NativeCommandError. `gh repo view` exits with 1 when the repo does
# not exist yet, so keep native failures as exit codes and check them explicitly.
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step([string]$message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Assert-Success([string]$activity) {
  if ($LASTEXITCODE -ne 0) {
    throw "$activity failed with exit code $LASTEXITCODE."
  }
}

function Test-GitHubRepo([string]$repository) {
  # `gh repo view` writes "not found" to stderr and exits 1 for a repo that does
  # not exist. Never let that surface as a terminating error.
  try {
    gh repo view $repository --json name 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Test-GitHubAuth {
  try {
    gh auth status 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

Write-Step "Checking tooling"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git is not installed or not on PATH."
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/"
}

Write-Step "Checking GitHub authentication"
if (-not (Test-GitHubAuth)) {
  throw "GitHub CLI is not authenticated. Run: gh auth login  (choose GitHub.com, HTTPS, login with a browser)"
}

Write-Step "Preparing the local repository"
if (-not (Test-Path ".git")) {
  git init -b main | Out-Host
  Assert-Success "git init"
}

git add -A 2>&1 | ForEach-Object { Write-Host "$_" }
Assert-Success "git add"

$pending = git status --porcelain
if ($pending) {
  $userName = git config user.name 2>$null
  $userEmail = git config user.email 2>$null
  if (-not $userName -or -not $userEmail) {
    throw "Git identity is not configured. Run: git config user.name `"Your Name`" and git config user.email `"you@example.com`" (add --global to apply it everywhere), then re-run this script."
  }

  git commit -m "feat: HexCoach League of Legends overlay" 2>&1 | ForEach-Object { Write-Host "$_" }
  Assert-Success "git commit"
} else {
  Write-Host "Nothing to commit." -ForegroundColor DarkGray
}

Write-Step "Creating the GitHub repository"
if (Test-GitHubRepo $Name) {
  Write-Host "Repository $Name already exists; using it." -ForegroundColor Yellow
} else {
  gh repo create $Name "--$Visibility" --source . "--remote" $Remote --description "HexCoach - a fast Tauri overlay coach for League of Legends" | Out-Host
  Assert-Success "gh repo create"
}

$remotes = @(git remote)
if ($remotes -notcontains $Remote) {
  $ownerOutput = gh api user --jq .login 2>$null
  Assert-Success "gh api user"
  $owner = (($ownerOutput | Out-String).Trim() -split "`r?`n")[0]
  if (-not $owner) {
    throw "Could not resolve the GitHub account name. Run: gh auth status"
  }

  $repoPath = if ($Name -match "/") { $Name } else { "$owner/$Name" }
  git remote add $Remote "https://github.com/$repoPath.git"
  Assert-Success "git remote add"
}

Write-Step "Pushing main"
# Merge stderr into the output stream so a rejected push is reported as a normal
# message plus our own error, instead of a PowerShell NativeCommandError.
$pushOutput = git push -u $Remote main 2>&1
$pushOutput | ForEach-Object { Write-Host "$_" }
if ($LASTEXITCODE -ne 0) {
  throw "git push failed. If the remote repository already contains commits, run: git pull --rebase $Remote main  and then re-run this script."
}

$url = gh repo view "$Name" --json url --jq .url 2>$null
if ($LASTEXITCODE -ne 0 -or -not $url) {
  $url = (git remote get-url $Remote 2>$null) `
    -replace "\.git$", "" `
    -replace "^git@github\.com:", "https://github.com/"
}
$url = "$url".Trim()

Write-Host ""
Write-Host "Published: $url" -ForegroundColor Green
Write-Host "GitHub Actions will build the Windows installer from the release workflow." -ForegroundColor Green
