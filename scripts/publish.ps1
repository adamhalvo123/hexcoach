<#
.SYNOPSIS
  Creates the GitHub repository for HexCoach from this local folder and pushes it.

.DESCRIPTION
  Requires an authenticated GitHub CLI. Run `gh auth login` once, then re-run this
  script. It initialises git if needed, creates the first commit, creates the
  repository on your account and pushes `main`.

.PARAMETER Name
  Repository name. Defaults to the folder name ("league coach").

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

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step([string]$message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

Write-Step "Checking tooling"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git is not installed or not on PATH."
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/"
}

Write-Step "Checking GitHub authentication"
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "GitHub CLI is not authenticated. Run: gh auth login  (choose GitHub.com, HTTPS, login with a browser)"
}

Write-Step "Preparing the local repository"
if (-not (Test-Path ".git")) {
  git init -b main | Out-Host
}

git add -A
$pending = git status --porcelain
if ($pending) {
  git -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" commit -m "feat: HexCoach League of Legends overlay" | Out-Host
} else {
  Write-Host "Nothing to commit." -ForegroundColor DarkGray
}

Write-Step "Creating the GitHub repository"
$existing = gh repo view "$Name" 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Repository $Name already exists; using it." -ForegroundColor Yellow
} else {
  gh repo create $Name "--$Visibility" --source . "--remote" $Remote --description "HexCoach - a fast Tauri overlay coach for League of Legends" | Out-Host
}

$remotes = git remote
if ($remotes -notcontains $Remote) {
  $owner = gh api user --jq .login
  git remote add $Remote "https://github.com/$owner/$Name.git"
}

Write-Step "Pushing main"
git push -u $Remote main | Out-Host

$url = gh repo view --json url --jq .url
Write-Host ""
Write-Host "Published: $url" -ForegroundColor Green
Write-Host "GitHub Actions will build the Windows installer from the release workflow." -ForegroundColor Green
