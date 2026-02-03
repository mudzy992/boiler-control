# Boiler Control System - Documentation Index

**Last Updated:** February 3, 2026
**Project Status:** V2 Implementation Complete ✅ | Docker Refactored ✅

---

## 📚 Documentation Organization

All project documentation has been centralized in this `docs/` directory for better organization and maintenance.

---

## 🎯 Start Here

### New to the Project?
1. **[../README.md](../README.md)** - Main project overview with quick start
2. **[README_MONOREPO.md](./README_MONOREPO.md)** - Detailed monorepo structure
3. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Common commands and workflows

### Want to Deploy?
1. **[../docker-compose.yml](../docker-compose.yml)** - Backend orchestration
2. **[../backend/Dockerfile](../backend/Dockerfile)** - Multi-stage Docker build
3. **[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)** - Environment configuration

### Need Architecture Details?
1. **[V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md)** - Complete system architecture
2. **[V2_FRONTEND_GUIDE.md](./V2_FRONTEND_GUIDE.md)** - Frontend patterns
3. **[P2E_README.md](./P2E_README.md)** - AsyncLocalStorage implementation

---

## 📑 Documentation by Category

### Getting Started
- **[README_MONOREPO.md](./README_MONOREPO.md)** - Monorepo structure and setup
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Command reference
- **[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)** - Environment variables
- **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)** - Setup verification

### Architecture & Design
- **[V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md)** - System architecture
- **[V2_FRONTEND_GUIDE.md](./V2_FRONTEND_GUIDE.md)** - Frontend development guide
- **[V2_DOCUMENTATION_INDEX.md](./V2_DOCUMENTATION_INDEX.md)** - Frontend docs navigation
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Project overview

### Implementation Details
- **[P2E_README.md](./P2E_README.md)** - AsyncLocalStorage (P2e)
- **[P2E_COMPLETION_SUMMARY.md](./P2E_COMPLETION_SUMMARY.md)** - P2e completion
- **[BACKEND_INTEGRATION_STATUS.md](./BACKEND_INTEGRATION_STATUS.md)** - Backend status
- **[FRONTEND_REVIEW.md](./FRONTEND_REVIEW.md)** - Frontend review
- **[BACKEND_REVIEW.md](./BACKEND_REVIEW.md)** - Backend review
- **[BACKEND_WRITE_OPERATIONS_AUDIT.md](./BACKEND_WRITE_OPERATIONS_AUDIT.md)** - Write ops audit

### Project Status & Milestones
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Current project status
- **[V2_IMPLEMENTATION_COMPLETE.md](./V2_IMPLEMENTATION_COMPLETE.md)** - V2 completion
- **[V2_SESSION_COMPLETION_REPORT.md](./V2_SESSION_COMPLETION_REPORT.md)** - Session report
- **[PHASE_1_COMPLETE.md](./PHASE_1_COMPLETE.md)** - Phase 1 summary
- **[PHASE_3_COMPLETION_CHECKLIST.md](./PHASE_3_COMPLETION_CHECKLIST.md)** - Phase 3 checklist
- **[PHASE_3_REFACTOR_SUMMARY.md](./PHASE_3_REFACTOR_SUMMARY.md)** - Phase 3 refactor

### Feature Guides
- **[MOBILE_V2_PLAN.md](./MOBILE_V2_PLAN.md)** - Mobile app V2 plan
- **[DASHBOARD_UPDATES_SUMMARY.md](./DASHBOARD_UPDATES_SUMMARY.md)** - Dashboard updates
- **[THERMOSTAT_FIX_CHECKLIST.md](./THERMOSTAT_FIX_CHECKLIST.md)** - Thermostat fixes
- **[THERMOSTAT_PROGRAMS_ENDPOINT_FIX.md](./THERMOSTAT_PROGRAMS_ENDPOINT_FIX.md)** - Endpoint fix

### Quick References
- **[V2_QUICK_REFERENCE.md](./V2_QUICK_REFERENCE.md)** - V2 quick reference
- **[V2_DELIVERABLES_MANIFEST.md](./V2_DELIVERABLES_MANIFEST.md)** - Deliverables list
- **[FILE_MANIFEST.md](./FILE_MANIFEST.md)** - File inventory
- **[EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)** - Executive summary

---

## 📂 Internal Documentation

Detailed technical documentation for specific implementations, pipelines, and operations.

### Architecture Deep Dives
- **[internal/architecture/](./internal/architecture/)** - Detailed architecture docs

### Deployment & Pipeline
- **[internal/pipeline/](./internal/pipeline/)** - Implementation pipelines
  - Batch 2/3 implementation checklists
  - P2B, P2C, P2D, P2E implementation summaries
  - Frontend integration guides
  - Deployment guides
  - TypeScript compilation fixes

### Monitoring & Observability
- **[internal/monitoring/](./internal/monitoring/)** - Monitoring setup
  - Monitoring setup guides
  - Baseline metrics

### Operations & Troubleshooting
- **[internal/runbooks/](./internal/runbooks/)** - Operational runbooks
  - P2E troubleshooting runbook

### Development Logs
- **[internal/logs/](./internal/logs/)** - Development logs
  - Backend progress logs
  - Batch verification reports

### Snapshots & Diffs
- **[internal/snapshots/](./internal/snapshots/)** - Code change snapshots
  - P2B, P2C, P2D diff reports
  - API change snapshots
  - Batch implementation diffs

### Directory Organization
- **[internal/DIRECTORY_OVERVIEW.md](./internal/DIRECTORY_OVERVIEW.md)** - Internal docs structure
- **[internal/REORGANIZATION_COMPLETE.md](./internal/REORGANIZATION_COMPLETE.md)** - Reorganization summary

---

## 🔍 Finding Documentation

### By Topic

**Backend Development:**
- [Backend README](../backend/README.md)
- [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md)
- [P2E_README.md](./P2E_README.md)
- [BACKEND_REVIEW.md](./BACKEND_REVIEW.md)

**Frontend Development:**
- [Web App README](../apps/web/README.md)
- [V2_FRONTEND_GUIDE.md](./V2_FRONTEND_GUIDE.md)
- [FRONTEND_REVIEW.md](./FRONTEND_REVIEW.md)

**Mobile Development:**
- [Mobile App README](../apps/mobile/README.md)
- [MOBILE_V2_PLAN.md](./MOBILE_V2_PLAN.md)

**Docker & Deployment:**
- [Root README](../README.md) - Docker quickstart
- [docker-compose.yml](../docker-compose.yml) - Orchestration config
- [backend/Dockerfile](../backend/Dockerfile) - Multi-stage build
- [internal/pipeline/](./internal/pipeline/) - Deployment guides

**Database:**
- [Backend Database Setup](../backend/DATABASE_SETUP.md)
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)

**Testing:**
- [Backend README](../backend/README.md#-testing)
- [internal/logs/](./internal/logs/) - Test verification reports

**Monitoring:**
- [internal/monitoring/MONITORING_SETUP.md](./internal/monitoring/MONITORING_SETUP.md)
- [internal/monitoring/BASELINE_METRICS.md](./internal/monitoring/BASELINE_METRICS.md)

---

## 🆘 Common Questions

### How do I get started?
1. Read [../README.md](../README.md)
2. Follow [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)
3. Reference [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

### How do I deploy with Docker?
1. Read Docker section in [../README.md](../README.md#-docker--deployment)
2. Configure [../docker-compose.yml](../docker-compose.yml)
3. Follow deployment guides in [internal/pipeline/](./internal/pipeline/)

### Where is the API documentation?
- **Swagger UI**: http://localhost:3020/api (when backend running)
- **Backend README**: [../backend/README.md](../backend/README.md#-api-endpoints)

### How do I troubleshoot issues?
1. Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#troubleshooting)
2. Review [internal/runbooks/](./internal/runbooks/)
3. Search [internal/logs/](./internal/logs/) for similar issues

### What's the current project status?
- [PROJECT_STATUS.md](./PROJECT_STATUS.md)
- [V2_IMPLEMENTATION_COMPLETE.md](./V2_IMPLEMENTATION_COMPLETE.md)

---

## 📝 Documentation Updates

This documentation structure was reorganized on February 3, 2026 as part of the Docker refactoring effort. All root-level markdown files have been moved to this `docs/` directory for better organization.

### Previous Locations
All documentation previously at the repository root is now in `docs/`:
- `V2_ARCHITECTURE.md` → `docs/V2_ARCHITECTURE.md`
- `QUICK_REFERENCE.md` → `docs/QUICK_REFERENCE.md`
- etc.

### Path Updates
The following files have been updated with new documentation paths:
- `README.md` (root)
- `.github/copilot-instructions.md`
- `backend/README.md`

---

## 🤝 Contributing to Documentation

When adding new documentation:
1. Place in appropriate category directory
2. Update this index
3. Use relative links for internal references
4. Follow markdown best practices
5. Include last updated date

---

**For the most up-to-date information, always check the project's root [README.md](../README.md)**

**Key Sections:**
- [P2a: Integration Tests](batch3-plan.md#p2a-integration-tests-poll--db-end-to-end)
- [P2b: Circuit Breaker](batch3-plan.md#p2b-request-timeout--circuit-breaker-tuya-adapter)
- [P2c: Logging](batch3-plan.md#p2c-structured-logging-expansion-tuya-adapter--anomaly-checker)
- [P2d: Performance](batch3-plan.md#p2d-performance-baseline-metrics-query-latency--api-response-time)

---

### 4. BATCH2_VERIFICATION_REPORT.md (~350 lines)

**Purpose:** Verification and sign-off report for Batch 2

**Sections:**
- Batch 2 objectives (P1c, P1d, P1e)
- Technical verification:
  - DI (resolved ✅)
  - TypeScript (0 errors ✅)
  - Backend runtime (0 errors ✅)
- Code changes summary (5 files modified, 92 lines)
- Constraint verification (all maintained ✅)
- Testing status (ready to run)
- Documentation generated
- Go/No-Go decision (✅ GO)
- Important notes (dev mode, metrics persistence)
- Questions answered
- Sign-off checklist

**When to Read:** Before production deployment or when confirming Batch 2 completion

**Key Findings:**
- ✅ All Batch 2 deliverables complete
- ✅ No breaking changes
- ✅ Ready for Batch 3 or production

---

## 🔗 Navigation by Topic

### Batch 2 Deliverables

| P1 Task | Document | Section |
|---------|----------|---------|
| **P1c: Transactions** | batch2-summary.md | [P1c Details](batch2-summary.md#p1c-transactional-integrity--idempotency) |
| **P1c: Idempotency** | batch2-summary.md | [Idempotency](batch2-summary.md#idempotency-strategy) |
| **P1d: Logging** | batch2-summary.md | [Structured Logging](batch2-summary.md#structured-logging-pattern) |
| **P1d: Metrics** | batch2-summary.md | [Prometheus Metrics](batch2-summary.md#prometheus-metrics-endpoint) |
| **P1e: Tests** | batch2-summary.md | [Contract Tests](batch2-summary.md#p1e-contract-tests) |

### Batch 3 Planning

| P2 Task | Document | Effort |
|---------|----------|--------|
| **P2a: Integration Tests** | batch3-plan.md | 6–9h |
| **P2b: Circuit Breaker** | batch3-plan.md | 8–11h |
| **P2c: Logging** | batch3-plan.md | 3–5h |
| **P2d: Performance** | batch3-plan.md | 7–11h |

### Implementation & Verification

| Topic | Document | Section |
|-------|----------|---------|
| Implementation details | batch2-summary.md | [Files Changed](batch2-summary.md#files-changed) |
| Verification steps | batch2-summary.md | [Verification Steps](batch2-summary.md#verification-steps) |
| Code changes | BATCH2_VERIFICATION_REPORT.md | [Code Changes Summary](BATCH2_VERIFICATION_REPORT.md#-code-changes-summary) |
| Technical status | BATCH2_VERIFICATION_REPORT.md | [Technical Verification](BATCH2_VERIFICATION_REPORT.md#-technical-verification) |

### Operations & Deployment

| Topic | Document | Section |
|-------|----------|---------|
| Project roadmap | PROJECT_STATUS.md | [Roadmap](PROJECT_STATUS.md#-batch-3-roadmap-p2ap2d) |
| Production readiness | PROJECT_STATUS.md | [Production Readiness](PROJECT_STATUS.md#-production-readiness) |
| Constraints | PROJECT_STATUS.md | [Safety Constraints](PROJECT_STATUS.md#-safety-constraints-all-maintained) |

---

## 🔍 Quick Reference

### File Locations in Backend

| File | Purpose | Batch 2 Change |
|------|---------|----------------|
| `src/modules/Schedule/schedule.module.ts` | Root scheduler | ✅ Added CommonModule import |
| `src/modules/ThermostatPoll/thermostat.polling.service.ts` | Polling logic | ✅ Added idempotency + logging |
| `src/common/structured-logger.ts` | Logging utility | ✅ Added durationMin field |
| `src/common/metrics.service.ts` | Metrics collection | ✅ (pre-existing, ready) |
| `src/common/metrics.controller.ts` | Metrics endpoints | ✅ (pre-existing, ready) |
| `test/contract/api-contract.spec.ts` | Contract tests | ✅ Fixed supertest import |
| `test/unit/tuya-adapter.spec.ts` | Unit tests | ✅ Fixed Prisma mock types |

---

## 📊 Statistics

### Documentation Generated

| Document | Lines | Focus |
|----------|-------|-------|
| batch2-summary.md | ~530 | Comprehensive Batch 2 details |
| batch3-plan.md | ~600+ | Batch 3 planning & acceptance criteria |
| PROJECT_STATUS.md | ~600 | Executive summary & roadmap |
| BATCH2_VERIFICATION_REPORT.md | ~350 | Verification & sign-off |
| **TOTAL** | **~2,080** | Complete backend documentation |

### Code Changes

| Category | Count |
|----------|-------|
| Files modified | 5 |
| Production code lines | ~92 |
| Test file fixes | 8 |
| Breaking changes | 0 |

### Verification Results

| Check | Result |
|-------|--------|
| TypeScript compilation | ✅ 0 errors |
| DI resolution | ✅ 0 errors |
| Backend runtime | ✅ 0 errors |
| Backward compatibility | ✅ 100% |

---

## 🎯 Action Items

### For Backend Team

1. **Review Batch 2 Implementation**
   - Read: [batch2-summary.md](batch2-summary.md)
   - Verify: All code changes understood
   - Check: No concerns with approach

2. **Review Batch 3 Plan**
   - Read: [batch3-plan.md](batch3-plan.md)
   - Approve: Task breakdown and effort
   - Confirm: Prioritization and parallelization

3. **Decide Next Steps**
   - [ ] Proceed with Batch 3 (as planned)
   - [ ] Deploy Batch 2 to staging/production
   - [ ] Adjust scope or priorities
   - [ ] Other (specify)

### For Frontend Team

1. **API Compatibility Check**
   - Review: Contract tests in batch2-summary.md
   - Verify: API endpoints match expectations
   - No breaking changes introduced ✅

2. **Optional: Early Testing**
   - Use `/metrics` endpoint (Prometheus)
   - Use `/metrics/json` endpoint (JSON)
   - No changes to existing API responses

---

## 📞 Document Maintenance

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-01 | Initial Batch 2 documentation + Batch 3 planning |

### Future Updates

- [ ] Update after Batch 3 implementation (add Batch 3 summary)
- [ ] Add production deployment report
- [ ] Update with performance baselines (P2d)
- [ ] Add monitoring & alerting guide

---

## 🎓 Learning Resources

### Understanding Key Concepts

**Transactional Integrity & Idempotency**
→ See [batch2-summary.md#p1c-section](batch2-summary.md#p1c-transactional-integrity--idempotency)

**Structured Logging with Correlation IDs**
→ See [batch2-summary.md#structured-logging-pattern](batch2-summary.md#structured-logging-pattern)

**Prometheus Metrics for Observability**
→ See [batch2-summary.md#prometheus-metrics-endpoint](batch2-summary.md#prometheus-metrics-endpoint)

**Circuit Breaker Pattern**
→ See [batch3-plan.md#p2b](batch3-plan.md#p2b-request-timeout--circuit-breaker-tuya-adapter)

**Integration Testing Strategy**
→ See [batch3-plan.md#p2a](batch3-plan.md#p2a-integration-tests-poll--db-end-to-end)

---

## ✅ Document Checklist

- ✅ Batch 2 implementation documented
- ✅ Batch 3 planning detailed
- ✅ Verification report complete
- ✅ Project status updated
- ✅ All files linked
- ✅ Quick reference provided
- ✅ Action items listed
- ✅ Navigation guide created

---

## 📝 How to Use This Index

1. **Quick Overview:** Start with [PROJECT_STATUS.md](PROJECT_STATUS.md) (5 min read)
2. **Deep Dive:** Read [batch2-summary.md](batch2-summary.md) (20 min read)
3. **Next Steps:** Review [batch3-plan.md](batch3-plan.md) (30 min read)
4. **Verification:** Check [BATCH2_VERIFICATION_REPORT.md](BATCH2_VERIFICATION_REPORT.md) (10 min read)
5. **Implementation:** Use this index to navigate to specific sections

**Total Read Time:** ~65 minutes for comprehensive understanding

---

## 🎉 Summary

**Batch 2 is complete and documented.** All code is production-ready with transactional safety, idempotency, structured logging, and Prometheus metrics. Batch 3 planning provides clear acceptance criteria and timeline for further hardening.

**Next: User decision on Batch 3 implementation or production deployment.**

---

**Document Version:** 1.0
**Date:** February 1, 2026
**Status:** Current & Ready for Use
