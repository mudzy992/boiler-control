# Boiler Control Backend - Monitoring Setup Guide

**Status**: P2e Production-Readiness
**Version**: 1.0
**Last Updated**: February 2, 2026

---

## Overview

This guide covers the monitoring infrastructure for the Boiler Control Backend, including Prometheus for metrics collection and Grafana for visualization.

## Quick Start

### Local Development Stack

Start local Prometheus + Grafana stack:

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

Access:
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

### Stopping the Stack

```bash
docker-compose -f docker-compose.monitoring.yml down
```

---

## Prometheus Configuration

**Location**: `docs/internal/monitoring/prometheus.yml`

### Scrape Jobs

#### 1. Backend Metrics (job_name: backend-metrics)
- **Target**: `localhost:3020`
- **Interval**: 15 seconds
- **Path**: `/metrics`
- **Metrics**: All Prometheus-format metrics from the backend

**Included Metrics**:
- `reporting_home_health_score` - Overall home health score (0-100)
- `reporting_anomaly_rate_per_hour` - Detected anomalies per hour
- `reporting_fallback_rate_per_hour` - Fallback strategy invocations per hour
- `reporting_active_alerts` - Currently active system alerts
- `http_requests_total` - Total HTTP requests by status
- `http_request_duration_ms` - Request latency histogram
- `nodejs_memory_usage_bytes` - Node.js memory consumption

#### 2. Reporting Metrics (job_name: backend-reporting)
- **Target**: `localhost:3020`
- **Interval**: 1 minute (less frequent)
- **Path**: `/metrics/reporting`
- **Metrics**: Business metrics only (reporting_*)

### Configuration Details

```yaml
global:
  scrape_interval: 15s      # How often to scrape metrics
  scrape_timeout: 10s       # Request timeout
  evaluation_interval: 15s  # Alert evaluation interval
```

### Modifying Scrape Intervals

To change how frequently metrics are collected:

```yaml
scrape_configs:
  - job_name: 'backend-metrics'
    scrape_interval: 30s    # Change from 15s to 30s
```

---

## Grafana Dashboard

**Location**: `docs/internal/monitoring/grafana-dashboard.json`

### Dashboard Panels

#### 1. Home Health Score
- **Metric**: `reporting_home_health_score`
- **Type**: Time series
- **Range**: 0-100
- **Alert Thresholds**:
  - Green: > 70
  - Yellow: 50-70
  - Red: < 50

#### 2. Anomaly Detection Rate
- **Metric**: `reporting_anomaly_rate_per_hour`
- **Type**: Time series
- **Unit**: Anomalies/hour
- **Alert Thresholds**:
  - Green: 0-2
  - Yellow: 2-5
  - Red: > 5

#### 3. Fallback Strategy Rate
- **Metric**: `reporting_fallback_rate_per_hour`
- **Type**: Time series
- **Unit**: Fallbacks/hour
- **Alert Thresholds**:
  - Green: 0-1
  - Yellow: 1-3
  - Red: > 3

#### 4. Active System Alerts
- **Metric**: `reporting_active_alerts`
- **Type**: Time series
- **Unit**: Count
- **Alert Thresholds**:
  - Green: 0-1
  - Yellow: 1-3
  - Red: > 3

#### 5. API Response Latency
- **Metrics**:
  - `histogram_quantile(0.95, ...)` - p95 latency
  - `histogram_quantile(0.99, ...)` - p99 latency
- **Type**: Time series
- **Unit**: Milliseconds
- **Alert Thresholds**:
  - Green: < 100ms
  - Yellow: 100-500ms
  - Red: > 500ms

#### 6. HTTP Request Rate
- **Metric**: `rate(http_requests_total[1m])`
- **Type**: Time series (stacked by status code)
- **Unit**: Requests/sec
- **Colors**:
  - Green: 200-299 (Success)
  - Yellow: 400-499 (Client Errors)
  - Red: 500-599 (Server Errors)

#### 7. Error Rate
- **Query**: `(rate(http_requests_total{status=~'5..'}[5m]) / rate(http_requests_total[5m])) * 100`
- **Type**: Time series
- **Unit**: Percentage (%)
- **Alert Thresholds**:
  - Green: 0-5%
  - Yellow: 5-10%
  - Red: > 10%

### Importing Dashboard

1. Open Grafana (http://localhost:3000)
2. Go to: **Dashboards** → **Import**
3. Upload: `docs/internal/monitoring/grafana-dashboard.json`
4. Select Prometheus as data source
5. Click **Import**

---

## Metrics Reference

### P2d Reporting Metrics

| Metric | Type | Description | Update Frequency |
|--------|------|-------------|-------------------|
| `reporting_home_health_score` | Gauge | Overall health (0-100) | Daily |
| `reporting_anomaly_rate_per_hour` | Gauge | Anomalies detected/hour | Hourly |
| `reporting_fallback_rate_per_hour` | Gauge | Fallback invocations/hour | Hourly |
| `reporting_active_alerts` | Gauge | Current active alerts | Real-time |

### System Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by status |
| `http_request_duration_ms` | Histogram | Request latency buckets |
| `nodejs_memory_usage_bytes` | Gauge | Memory usage by category |
| `process_uptime_seconds` | Gauge | Process uptime |

---

## Alert Rules (Optional)

Create `docs/internal/monitoring/alert_rules.yml`:

```yaml
groups:
  - name: boiler-control
    interval: 15s
    rules:
      - alert: HighAnomalyRate
        expr: reporting_anomaly_rate_per_hour > 5
        for: 5m
        annotations:
          summary: "High anomaly detection rate"

      - alert: HighErrorRate
        expr: (rate(http_requests_total{status=~'5..'}[5m]) / rate(http_requests_total[5m])) > 0.1
        for: 5m
        annotations:
          summary: "HTTP error rate exceeds 10%"

      - alert: LowHealthScore
        expr: reporting_home_health_score < 50
        for: 10m
        annotations:
          summary: "Home health score below 50"
```

Enable in Prometheus config:

```yaml
rule_files:
  - '/etc/prometheus/alert_rules.yml'
```

---

## Production Deployment

### 1. Kubernetes Deployment

Deploy Prometheus as StatefulSet:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: prometheus
spec:
  serviceName: prometheus
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: prometheus-config
          mountPath: /etc/prometheus
        - name: prometheus-data
          mountPath: /prometheus
      volumes:
      - name: prometheus-config
        configMap:
          name: prometheus-config
  volumeClaimTemplates:
  - metadata:
      name: prometheus-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 50Gi
```

### 2. Storage Retention

Configure data retention in Prometheus:

```yaml
# Keep metrics for 30 days
--storage.tsdb.retention.time=30d

# Or limit by size
--storage.tsdb.retention.size=50GB
```

### 3. High Availability

For production HA setup:

```bash
# Start multiple Prometheus instances with different ports
prometheus --storage.tsdb.path=/prometheus1 --web.listen-address=:9090
prometheus --storage.tsdb.path=/prometheus2 --web.listen-address=:9091
```

Use external alertmanager for alert deduplication.

---

## Troubleshooting

### Metrics Not Appearing

1. Check backend is running: `curl http://localhost:3020/health`
2. Check metrics endpoint: `curl http://localhost:3020/metrics`
3. Verify Prometheus scrape config in: `docs/internal/monitoring/prometheus.yml`
4. Check Prometheus targets: http://localhost:9090/targets

### High Memory Usage

- Increase retention period carefully
- Reduce scrape interval if metrics are too frequent
- Consider downsampling old data

### Missing Dashboards

- Ensure `grafana-provisioning/dashboards/dashboards.yml` exists
- Copy dashboard JSON to `grafana-provisioning/dashboards/`
- Restart Grafana

---

## Integration with CI/CD

### Automated Smoke Tests

After deployment, run smoke tests that verify metrics collection:

```bash
npm run test:smoke
```

Verifies:
- ✅ `/metrics` endpoint responds
- ✅ `/metrics/json` endpoint responds
- ✅ Metrics are in Prometheus format
- ✅ Key business metrics are present

---

## Next Steps

1. **Staging Deployment**
   - Deploy Prometheus + Grafana to staging
   - Verify metrics flow correctly
   - Adjust alert thresholds based on baseline

2. **Production Deployment**
   - Deploy with persistent storage
   - Configure alert routing (PagerDuty, Slack, etc.)
   - Set up dashboard sharing for team

3. **Runbooks**
   - Create runbooks for each alert type
   - Document on-call procedures
   - Link from dashboard annotations

---

## Related Documentation

- **Backend Metrics Service**: [MetricsController](../../../src/common/metrics.controller.ts)
- **Reporting Service**: [ReportingService](../../../src/common/reporting.service.ts)
- **Prometheus Docs**: https://prometheus.io/docs/
- **Grafana Docs**: https://grafana.com/docs/
- **P2d Implementation**: [P2D_DIFF_REPORT.md](../snapshots/P2D_DIFF_REPORT.md)

---

## Support

For questions or issues with monitoring setup:
1. Check Prometheus targets page: http://localhost:9090/targets
2. Review Prometheus logs: `docker logs boiler-prometheus`
3. Review Grafana logs: `docker logs boiler-grafana`
4. Refer to official documentation links above
