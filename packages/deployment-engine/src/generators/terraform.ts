import type { GraphNode } from '@genesis-1/shared';
import type { DeployableModule, DeploymentConfig } from '../engine';

export class TerraformGenerator {
  generate(nodes: GraphNode[], config: DeploymentConfig): DeployableModule[] {
    const modules: DeployableModule[] = [];
    const provider = config.cloudProvider ?? 'aws';

    // Main TF config
    modules.push(this.generateMain(nodes, config));

    // Variables
    modules.push(this.generateVariables(config));

    // Outputs
    modules.push(this.generateOutputs(config));

    // Provider-specific modules
    if (provider === 'aws') {
      modules.push(this.generateAWSProvider(config));
      modules.push(this.generateECSModule(nodes, config));
      modules.push(this.generateRDSModule(nodes, config));
    } else if (provider === 'gcp') {
      modules.push(this.generateGCPProvider(config));
    } else if (provider === 'azure') {
      modules.push(this.generateAzureProvider(config));
    }

    // Backend
    modules.push(this.generateBackend(config));

    return modules;
  }

  private generateMain(nodes: GraphNode[], config: DeploymentConfig): DeployableModule {
    const services = nodes.filter((n) => ['service', 'function', 'container', 'api_gateway'].includes(n.type));
    return {
      path: 'terraform/main.tf',
      content: `# Genesis-1 Generated Terraform
# Cloud: ${config.cloudProvider ?? 'aws'}
# Region: ${config.region ?? 'us-east-1'}
# Environment: ${config.environment}

terraform {
  required_version = ">= 1.5"
  backend "s3" {
    bucket         = "genesis-tfstate-${config.projectId}"
    key            = "${config.environment}/terraform.tfstate"
    region         = "${config.region ?? 'us-east-1'}"
    encrypt        = true
    dynamodb_table = "genesis-tfstate-lock"
  }
}

provider "${config.cloudProvider ?? 'aws'}" {
  region = var.region
}

# Services: ${services.map((s) => s.name).join(', ')}
`,
      language: 'hcl', type: 'terraform', description: 'Main Terraform configuration',
    };
  }

  private generateVariables(config: DeploymentConfig): DeployableModule {
    return {
      path: 'terraform/variables.tf',
      content: `variable "region" {
  description = "Deployment region"
  type        = string
  default     = "${config.region ?? 'us-east-1'}"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "${config.environment}"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "genesis-app"
}

variable "min_capacity" {
  description = "Minimum number of instances"
  type        = number
  default     = ${config.scaling?.min ?? 1}
}

variable "max_capacity" {
  description = "Maximum number of instances"
  type        = number
  default     = ${config.scaling?.max ?? 10}
}

variable "cpu_target" {
  description = "CPU target for autoscaling"
  type        = number
  default     = ${config.scaling?.targetCpuPercent ?? 70}
}
`,
      language: 'hcl', type: 'terraform', description: 'Terraform variables',
    };
  }

  private generateOutputs(config: DeploymentConfig): DeployableModule {
    return {
      path: 'terraform/outputs.tf',
      content: `output "cluster_endpoint" {
  value       = module.ecs.cluster_endpoint
  description = "ECS cluster endpoint"
}

output "load_balancer_dns" {
  value       = module.ecs.lb_dns_name
  description = "Load balancer DNS name"
}

output "database_endpoint" {
  value       = module.rds.endpoint
  description = "RDS database endpoint"
  sensitive   = true
}
`,
      language: 'hcl', type: 'terraform', description: 'Terraform outputs',
    };
  }

  private generateBackend(config: DeploymentConfig): DeployableModule {
    return {
      path: 'terraform/backend.tf',
      content: `# Remote state backend
# Uncomment and configure for your cloud provider:
#
# terraform {
#   backend "s3" {
#     bucket = "genesis-tfstate"
#     key    = "${config.environment}/terraform.tfstate"
#     region = "${config.region ?? 'us-east-1'}"
#   }
# }
`,
      language: 'hcl', type: 'terraform', description: 'Terraform backend configuration',
    };
  }

  private generateAWSProvider(config: DeploymentConfig): DeployableModule {
    return {
      path: 'terraform/providers.tf',
      content: `provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "genesis-1"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}
`,
      language: 'hcl', type: 'terraform', description: 'AWS provider configuration',
    };
  }

  private generateECSModule(nodes: GraphNode[], config: DeploymentConfig): DeployableModule {
    const services = nodes.filter((n) => ['service', 'container', 'api_gateway'].includes(n.type));
    return {
      path: 'terraform/modules/ecs/main.tf',
      content: `# ECS Fargate Cluster for ${services.map((s) => s.name).join(', ')}
resource "aws_ecs_cluster" "main" {
  name = "genesis-${config.environment}-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = {
    Environment = var.environment
    ManagedBy   = "genesis-1"
  }
}

# Service definitions
${services.map((svc) => this.ecsServiceDefinition(svc, config)).join('\n\n')}
`,
      language: 'hcl', type: 'terraform', description: 'ECS module',
    };
  }

  private ecsServiceDefinition(svc: GraphNode, config: DeploymentConfig): string {
    const name = svc.name.toLowerCase().replace(/\s+/g, '-');
    const port = (svc.runtime as Record<string, unknown>)?.port ?? 3000;
    return `resource "aws_ecs_service" "${name}" {
  name            = "${name}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.${name}.arn
  desired_count   = var.min_capacity
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = data.aws_subnets.private.ids
    security_groups  = [aws_security_group.${name}.id]
    assign_public_ip = false
  }
  deployment_controller {
    type = "ECS"
  }
}

resource "aws_ecs_task_definition" "${name}" {
  family                   = "${name}"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "${(svc.runtime as Record<string, unknown>)?.cpu ?? '512'}"
  memory                   = "${(svc.runtime as Record<string, unknown>)?.memory ?? '1024'}"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions    = jsonencode([{
    name  = "${name}"
    image = "${name}:latest"
    portMappings = [{ containerPort = ${port} }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group  = "/ecs/genesis/${name}"
        awslogs-region = var.region
      }
    }
  }])
}`;
  }

  private generateRDSModule(nodes: GraphNode[], config: DeploymentConfig): DeployableModule {
    const dbs = nodes.filter((n) => n.type === 'database');
    if (dbs.length === 0) return { path: 'terraform/modules/rds/main.tf', content: '# No databases defined', language: 'hcl', type: 'terraform', description: 'RDS module' };

    return {
      path: 'terraform/modules/rds/main.tf',
      content: `${dbs.map((db) => `resource "aws_db_instance" "${db.name.toLowerCase().replace(/\s+/g, '_')}" {
  identifier        = "genesis-${config.environment}-db"
  engine            = "postgres"
  engine_version    = "16.1"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_encrypted = true
  skip_final_snapshot = false
  backup_retention_period = 7
  enabled_cloudwatch_logs_exports = ["postgresql"]
  tags = {
    Environment = var.environment
    ManagedBy   = "genesis-1"
  }
}`).join('\n\n')}`,
      language: 'hcl', type: 'terraform', description: 'RDS module',
    };
  }

  private generateGCPProvider(config: DeploymentConfig): DeployableModule {
    return { path: 'terraform/providers.tf', content: `provider "google" {\n  project = var.project_id\n  region  = var.region\n}\n`, language: 'hcl', type: 'terraform', description: 'GCP provider' };
  }

  private generateAzureProvider(config: DeploymentConfig): DeployableModule {
    return { path: 'terraform/providers.tf', content: `provider "azurerm" {\n  features {}\n}\n`, language: 'hcl', type: 'terraform', description: 'Azure provider' };
  }
}
