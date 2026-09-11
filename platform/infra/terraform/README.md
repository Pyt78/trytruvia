# Truvia infrastructure baseline

Terraform for the Phase 0 footprint in AWS `me-central-1` (UAE): VPC with private
subnets, a customer-managed KMS key with rotation, an encrypted and version-locked
evidence bucket with S3 Object Lock, an encrypted RDS Postgres instance with managed
credentials, and a KMS-encrypted log group.

Nothing here has been applied yet — no AWS credentials are configured for the project.
Before the first apply:

1. Create the Terraform state backend (S3 bucket + DynamoDB lock table) in `me-central-1`
   and add a `backend "s3"` block to `versions.tf`.
2. Provide credentials for a deployment role scoped to the Truvia account.
3. `terraform init && terraform plan -var environment=dev`.

The `region` variable is validated to reject any non-Middle-East region, so customer
data cannot be provisioned outside the residency commitment by accident.
