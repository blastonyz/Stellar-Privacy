# Creates a GCS bucket for Shield register-state persistence and grants Cloud Run access.
# Usage (from repo root, project verifier-501200):
#   .\run\setup-gcs-register-bucket.ps1
#   .\run\setup-gcs-register-bucket.ps1 -ProjectId my-gcp-project -Region us-central1

param(
  [string]$ProjectId = "verifier-501200",
  [string]$Region = "us-central1",
  [string]$BucketName = ""
)

$ErrorActionPreference = "Stop"

if (-not $BucketName) {
  $BucketName = "$ProjectId-register-states"
}

Write-Host "Project: $ProjectId"
Write-Host "Bucket:  gs://$BucketName"

gcloud config set project $ProjectId

$bucketUri = "gs://$BucketName"

# gcloud writes 404 to stderr; do not treat "bucket missing" as a script failure.
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
gcloud storage buckets describe $bucketUri 2>$null | Out-Null
$bucketExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevEap

if (-not $bucketExists) {
  Write-Host "Creating bucket $bucketUri ..."
  gcloud storage buckets create $bucketUri --location=$Region --uniform-bucket-level-access
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create bucket $bucketUri"
  }
} else {
  Write-Host "Bucket already exists."
}

$projectNumber = (gcloud projects describe $ProjectId --format="value(projectNumber)")
$runSa = "$projectNumber-compute@developer.gserviceaccount.com"

Write-Host "Granting storage.objectAdmin to Cloud Run service account: $runSa"
gcloud storage buckets add-iam-policy-binding $bucketUri `
  --member="serviceAccount:$runSa" `
  --role="roles/storage.objectAdmin"

if ($LASTEXITCODE -ne 0) {
  throw "Failed to set bucket IAM for $runSa"
}

Write-Host ""
Write-Host "Done. Deploy verifier with:"
Write-Host "  gcloud builds submit . --config=cloudbuild.yaml"
Write-Host ""
Write-Host "  gcloud run deploy verifier ``"
Write-Host "    --image gcr.io/$ProjectId/verifier ``"
Write-Host "    --region $Region ``"
Write-Host "    --allow-unauthenticated ``"
Write-Host "    --set-env-vars GCS_REGISTER_STATE_BUCKET=$BucketName,PERSIST_REGISTER_STATE=true,..."
