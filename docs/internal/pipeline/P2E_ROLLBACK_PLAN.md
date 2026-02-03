# P2E Rollback Plan (Backend)

Purpose: safe, documented rollback steps for backend-only deploys (no DB schema changes expected in P2d).

## Principles
- Keep rollbacks code-only when possible (no schema migration to revert).
- Use feature flags for risky changes.
- Monitor health and alert channels; trigger rollback if critical errors or increased error rate.

## Preconditions
- Know the previous stable release tag (e.g., `vX.Y.Z`).
- Ensure container image or artifact for previous tag is available in registry.
- Ensure CI artifacts and deployment manifests are versioned.

## Immediate Rollback Steps (fast path)
1. Notify stakeholders (Slack/PagerDuty): Backend owner, On-call, Frontend owner.
2. Flip feature flag(s) (if relevant) to disable new functionality.
3. If feature-flag flip insufficient, redeploy previous backend release:
   - Kubernetes: `kubectl rollout undo deployment/<backend-deployment> --to-revision=<rev>`
   - Docker Compose: `docker-compose pull <service>:<previous-tag>` then `docker-compose up -d`
4. Run smoke checks against staging/production endpoints:

```bash
curl -f http://<host>/health
curl -f http://<host>/metrics
curl -f http://<host>/metrics/reporting
```

5. If rollback successful, monitor metrics for 15 minutes; keep stakeholders updated.

## Safe Rollback Without DB Changes
- Since P2d introduces no schema changes, full code rollback is safe. Ensure:
  - Any message queue consumers are idempotent or can be paused.
  - No long-running migrations or background jobs are left mid-execution that depend on new code paths.

## If DB Changes Are Introduced (not applicable for P2d)
- Follow formal DB migration rollback plan in `DB_MIGRATIONS.md` and coordinate with DBA/ops.

## Post-Rollback Actions
- Gather logs from failed release; capture core dumps and stack traces.
- Create a postmortem entry and assign remediation tasks.
- Reproduce failure in staging and create a fix branch.

## Monitoring & Alerting Thresholds
- Automatic rollback triggers (suggested):
  - >5% 5xx rate sustained for 5 minutes
  - Service health endpoint returns non-200 for 2 consecutive probes
  - Prometheus: `reporting_active_alerts{severity="critical"} > 0` for 2 minutes

## Contact & Escalation
- Backend owner: (list)
- Oncall rotation: (list)
- Frontend owner: (list)

## Notes
- Keep rollback windows short and communicate status frequently.
- Maintain deployment artifacts for at least 30 days.
- Do not modify database schema in emergency rollback — instead, revert code and handle data fixes separately.
