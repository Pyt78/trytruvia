variable "region" {
  description = "AWS region. Customer data must stay in the UAE region."
  type        = string
  default     = "me-central-1"

  validation {
    condition     = startswith(var.region, "me-")
    error_message = "Truvia customer data may only be provisioned in a Middle East region."
  }
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the platform VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "evidence_retention_days" {
  description = "Minimum retention for evidence objects, in days."
  type        = number
  default     = 2555
}
