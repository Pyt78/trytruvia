# Phase 0 AWS footprint in the UAE region. Everything customer data touches is
# encrypted with a customer-managed key, kept private, and retained: the
# evidence bucket is versioned and Object Locked so an artefact an auditor relies
# on cannot be silently altered or deleted.
#
# Not applied yet — see README.md in this directory for the prerequisites.

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name     = "truvia-${var.environment}"
  az_count = min(2, length(data.aws_availability_zones.available.names))
}

# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = local.name }
}

resource "aws_subnet" "private" {
  count             = local.az_count
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "${local.name}-private-${count.index}" }
}

resource "aws_subnet" "public" {
  count                   = local.az_count
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index + 8)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false

  tags = { Name = "${local.name}-public-${count.index}" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = local.name }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${local.name}-public" }
}

resource "aws_route_table_association" "public" {
  count          = local.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# Encryption
# ---------------------------------------------------------------------------

resource "aws_kms_key" "platform" {
  description             = "Truvia platform data (evidence, database, logs)"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_kms_alias" "platform" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.platform.key_id
}

# ---------------------------------------------------------------------------
# Evidence storage: versioned, encrypted, immutable, private
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "evidence" {
  bucket        = "${local.name}-evidence"
  force_destroy = false

  object_lock_enabled = true
}

resource "aws_s3_bucket_versioning" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.platform.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket                  = aws_s3_bucket.evidence.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_object_lock_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = var.evidence_retention_days
    }
  }

  depends_on = [aws_s3_bucket_versioning.evidence]
}

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "database" {
  name        = "${local.name}-db"
  description = "Postgres access from platform services only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Postgres from within the VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "main" {
  identifier                   = local.name
  engine                       = "postgres"
  engine_version               = "16.4"
  instance_class               = "db.t4g.medium"
  allocated_storage            = 50
  max_allocated_storage        = 500
  db_name                      = "truvia"
  username                     = "truvia"
  manage_master_user_password  = true
  db_subnet_group_name         = aws_db_subnet_group.main.name
  vpc_security_group_ids       = [aws_security_group.database.id]
  storage_encrypted            = true
  kms_key_id                   = aws_kms_key.platform.arn
  backup_retention_period      = 14
  deletion_protection          = true
  auto_minor_version_upgrade   = true
  performance_insights_enabled = true
  skip_final_snapshot          = false
  final_snapshot_identifier    = "${local.name}-final"
}

# ---------------------------------------------------------------------------
# Audit trail for the AWS account itself
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "platform" {
  name              = "/truvia/${var.environment}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.platform.arn
}
