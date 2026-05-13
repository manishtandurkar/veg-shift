# Parameters with defaults
param(
  [string]$Input = 'docs/data_flow.mmd',
  [string]$OutSvg = 'docs/data_flow.svg',
  [string]$OutPng = 'docs/data_flow.png'
)

# Resolve paths to absolute to avoid mmdc reading from stdin when relative paths fail
# Ensure $Input has a sensible default and resolve relative to script folder when necessary
if ([string]::IsNullOrWhiteSpace($Input)) { $Input = 'docs/data_flow.mmd' }

# If input path is not rooted, try relative to script directory first, then current dir
if ([System.IO.Path]::IsPathRooted($Input)) {
  $candidate = $Input
} else {
  $candidate = Join-Path -Path $PSScriptRoot -ChildPath $Input
  if (-not (Test-Path $candidate)) {
    $candidate = Join-Path -Path (Get-Location) -ChildPath $Input
  }
}

if (-not (Test-Path $candidate)) {
  Write-Error "Input file not found: $Input (tried: $candidate)"
  exit 2
}

$inPath = (Resolve-Path -Path $candidate -ErrorAction Stop).Path

# Ensure mmdc is available in PATH
$mmdcCmd = Get-Command mmdc -ErrorAction SilentlyContinue
if (-not $mmdcCmd) {
  Write-Error "Mermaid CLI 'mmdc' not found. Install with: npm install -g @mermaid-js/mermaid-cli"
  exit 1
}

$outSvgPath = [System.IO.Path]::GetFullPath($OutSvg)
$outPngPath = [System.IO.Path]::GetFullPath($OutPng)

Write-Host "Rendering $inPath → $outSvgPath"
& mmdc -i $inPath -o $outSvgPath
if ($LASTEXITCODE -ne 0) { Write-Error "mmdc failed for SVG"; exit $LASTEXITCODE }

Write-Host "Rendering $inPath → $outPngPath"
& mmdc -i $inPath -o $outPngPath
if ($LASTEXITCODE -ne 0) { Write-Error "mmdc failed for PNG"; exit $LASTEXITCODE }

Write-Host "Done. Files: $outSvgPath, $outPngPath"
