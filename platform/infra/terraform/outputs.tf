output "region" {
  value = var.region
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "evidence_bucket" {
  value = aws_s3_bucket.evidence.bucket
}

output "database_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "kms_key_arn" {
  value = aws_kms_key.platform.arn
}
