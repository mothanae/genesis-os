import type { DeployableModule, DeploymentConfig } from '../engine';

export class MonitoringGenerator {
  generate(config: DeploymentConfig): DeployableModule[] {
    const modules: DeployableModule[] = [];

    if (config.monitoring?.prometheus) {
      modules.push(this.generatePrometheusConfig(config));
      modules.push(this.generateAlertRules(config));
    }
    if (config.monitoring?.grafana) {
      modules.push(this.generateGrafanaDashboard(config));
      modules.push(this.generateGrafanaDatasource(config));
    }

    return modules;
  }

  private generatePrometheusConfig(config: DeploymentConfig): DeployableModule {
    return {
      path: 'monitoring/prometheus/prometheus.yml',
      content: `# Genesis-1 Generated Prometheus Config
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: ${config.environment}
    managed_by: genesis-1

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - 'alerts/*.yml'

scrape_configs:
  - job_name: 'app'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['app:3000']
        labels:
          service: genesis-app
          environment: ${config.environment}

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
`,
      language: 'yaml', type: 'monitoring', description: 'Prometheus configuration',
    };
  }

  private generateAlertRules(config: DeploymentConfig): DeployableModule {
    return {
      path: 'monitoring/prometheus/alerts/app-alerts.yml',
      content: `groups:
  - name: genesis-app-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
          environment: ${config.environment}
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} over the last 5 minutes"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
          environment: ${config.environment}
        annotations:
          summary: "High latency detected"
          description: "P95 latency is {{ $value }}s"

      - alert: ServiceDown
        expr: up{job="app"} == 0
        for: 2m
        labels:
          severity: critical
          environment: ${config.environment}
        annotations:
          summary: "Service is down"
          description: "App service has been down for more than 2 minutes"

      - alert: HighCPUUsage
        expr: avg(rate(container_cpu_usage_seconds_total[5m])) by (service) > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"

      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"

      - alert: DatabaseConnectionPoolNearLimit
        expr: pg_stat_database_numbackends / pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool near limit"
`,
      language: 'yaml', type: 'monitoring', description: 'Prometheus alert rules',
    };
  }

  private generateGrafanaDashboard(config: DeploymentConfig): DeployableModule {
    return {
      path: 'monitoring/grafana/dashboards/app-overview.json',
      content: JSON.stringify({
        title: `Genesis App — ${config.environment}`,
        uid: `genesis-${config.environment}`,
        tags: ['genesis-1', config.environment],
        timezone: 'browser',
        panels: [
          {
            title: 'Request Rate',
            type: 'graph',
            gridPos: { x: 0, y: 0, w: 12, h: 8 },
            targets: [{ expr: 'rate(http_requests_total[1m])', legendFormat: '{{ method }} {{ path }}' }],
          },
          {
            title: 'Error Rate',
            type: 'graph',
            gridPos: { x: 12, y: 0, w: 12, h: 8 },
            targets: [{ expr: 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])', legendFormat: 'Error Rate' }],
            thresholds: [{ value: 0.05, color: 'red' }],
          },
          {
            title: 'P95 Latency',
            type: 'graph',
            gridPos: { x: 0, y: 8, w: 8, h: 8 },
            targets: [{ expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))', legendFormat: 'P95' }],
          },
          {
            title: 'CPU Usage',
            type: 'graph',
            gridPos: { x: 8, y: 8, w: 8, h: 8 },
            targets: [{ expr: 'avg(rate(container_cpu_usage_seconds_total[5m])) by (service)', legendFormat: '{{ service }}' }],
          },
          {
            title: 'Memory Usage',
            type: 'graph',
            gridPos: { x: 16, y: 8, w: 8, h: 8 },
            targets: [{ expr: 'container_memory_usage_bytes / container_spec_memory_limit_bytes', legendFormat: '{{ service }}' }],
          },
          {
            title: 'Database Connections',
            type: 'graph',
            gridPos: { x: 0, y: 16, w: 12, h: 8 },
            targets: [{ expr: 'pg_stat_database_numbackends', legendFormat: 'Active Connections' }],
          },
          {
            title: 'Service Availability',
            type: 'stat',
            gridPos: { x: 12, y: 16, w: 12, h: 8 },
            targets: [{ expr: 'avg(up{job="app"}) * 100', legendFormat: 'Availability %' }],
            thresholds: [{ value: 99, color: 'green' }, { value: 95, color: 'orange' }, { value: 0, color: 'red' }],
          },
        ],
      }, null, 2),
      language: 'json', type: 'monitoring', description: 'Grafana dashboard JSON',
    };
  }

  private generateGrafanaDatasource(config: DeploymentConfig): DeployableModule {
    return {
      path: 'monitoring/grafana/datasources/prometheus.yml',
      content: `apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      timeInterval: "15s"
`,
      language: 'yaml', type: 'monitoring', description: 'Grafana datasource config',
    };
  }
}
