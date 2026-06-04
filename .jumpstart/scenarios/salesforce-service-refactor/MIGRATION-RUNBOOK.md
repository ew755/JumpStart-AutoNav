# Migration Runbook: Legacy Service Refactoring

**Version:** 1.0  
**Owner:** SfS Integration Team + Platform Team  
**Last Updated:** 2026-06-03  
**Status:** Template (to be refined during Phase 2 PM work)

---

## Executive Summary

This runbook governs the controlled migration from legacy call chain (`Query Service` → `Transformation Service`) to new distributed API architecture (`Facade API` → `Resource API` → `Backend System`).

**Key Constraint:** Zero customer-facing downtime. Cutover must be gradual and reversible.

---

## Pre-Cutover Checklist (Week 10)

### Infrastructure & Deployment
- [ ] New APIs (CX Consumer + CX Life) live in production (non-customer-facing)
- [ ] Integration Layer service deployed to staging (not yet routing real traffic)
- [ ] Feature flag system active (ability to toggle old vs new path)
- [ ] Monitoring + alerting configured for all new services
- [ ] Rollback procedures tested (can restart old path in <5 min)
- [ ] Database backups current + tested for recovery

### Data Validation
- [ ] Shadow read results show ≥99.5% consistency between old and new APIs
- [ ] All edge cases from legacy system tested in new APIs
- [ ] Audit logging configured (all read/write operations logged)
- [ ] Data discrepancies documented and understood

### Team Readiness
- [ ] Ops team trained on new architecture (runbooks, dashboards, escalation)
- [ ] Platform team available for on-call during cutover
- [ ] SfS consumers notified of migration (no action needed, transparent cutover)
- [ ] Rollback procedures rehearsed with ops team

### Load Testing
- [ ] New APIs tested under peak load (Dynatrace: latency, error rate, CPU)
- [ ] Backend System capacity validated (won't be overwhelmed)
- [ ] Cache layer (1hr TTL) validated for hit rate ≥70%
- [ ] Circuit breaker tested (graceful degradation when Backend System down)

---

## Cutover Timeline

### Phase 1: Shadow Reads (Week 5, Running in Parallel During Development)

**Duration:** 1 week  
**Traffic Split:** 0% new, 100% old  
**Risk Level:** Low (shadow path, no production impact)

**Process:**
1. Integration Layer routes SfS requests to BOTH old and new APIs
2. Responses collected from both paths
3. Compared and logged (differences flagged for investigation)
4. Customer sees only old API response (returns in real-time)

**Success Criteria:**
- New API responds within 5 seconds (shadow must not slow customer)
- ≥99.5% of shadow reads match old API results
- All differences logged and triaged
- No error spikes in monitoring

**Rollback:** Disable shadow reads (instant, no impact)

---

### Phase 2: Canary Deployment (Week 7, Post-CX Consumer Approval)

**Duration:** 3 days  
**Traffic Split:** 10% new, 90% old  
**Risk Level:** Medium (small production traffic, quick reversal if issues)

**Process:**
1. Feature flag: `route_to_new_api = 10%`
2. 10% of real SfS requests → new APIs (measured by random sampling)
3. Monitoring: Error rates, latency, data accuracy on the 10%
4. Old path continues serving 90% (no customer impact if 10% fails)

**Success Criteria:**
- New API error rate < old API error rate (must be better)
- New API latency ≤ old API latency ±10% (acceptable variance)
- No new error types (circuit breaker works, timeouts handled)
- Customer satisfaction score unchanged (they don't notice)

**Monitoring:**
```
Dashboard: SfS Canary 10% Split
├─ New API error rate (target: <0.1%)
├─ New API latency p50/p95/p99 (target: ≤500ms p95)
├─ Backend System CPU (target: <70%)
├─ Cache hit ratio (target: >70%)
└─ Rollback button: active (click to instant revert)
```

**Rollback Trigger:** If error rate > 1%, latency > 1s p95, or circuit breaker tripped >5x → instant rollback to 0% new

---

### Phase 3: Ramp-Up (Week 8, Day 4-5)

**Duration:** 2 days  
**Traffic Split:** 50% new, 50% old  
**Risk Level:** Medium-High (half of production traffic)

**Process:**
1. Feature flag: `route_to_new_api = 50%`
2. Half of real SfS requests → new APIs
3. Intensive monitoring (24/7 on-call coverage)
4. Alert threshold: Any metric deviates >10% from old path → page oncall

**Success Criteria (Same as Canary, but scaled):**
- New API error rate < old API error rate (must be better)
- New API latency consistent with canary results
- No new failure modes
- Load on LifePro backend managed (no throttling)

**Rollback Trigger:** Any of canary triggers, OR critical bug discovered during 50% run → instant revert to 0%

---

### Phase 4: Full Cutover (Week 8, Day 6)

**Duration:** 1 day (go-live + validation window)  
**Traffic Split:** 100% new, 0% old  
**Risk Level:** High (all production traffic, must succeed)

**Process:**
1. Feature flag: `route_to_new_api = 100%`
2. ALL SfS requests → new APIs (old path no longer used)
3. Old API kept running (read-only, for emergency rollback only)
4. Intensive monitoring + on-call team

**Success Criteria:**
- New API error rate < 0.1% (near-perfect)
- New API latency stable (no anomalies)
- All SfS consumers report normal operation
- Data accuracy 100% (spot-check customer records)

**Rollback Trigger (24-Hour Window):**
- Error rate > 0.5% → rollback to old
- Latency spikes > 50% above baseline → rollback
- Data discrepancies detected → rollback
- Customer complaint escalation → rollback

**Timeline:**
```
T+0:00  → Flip feature flag to 100% new
T+0:30  → Check dashboards (all green?)
T+1:00  → Check customer reports (any issues?)
T+2:00  → Manual spot-check: 5 random customers
T+4:00  → Declare victory or rollback
T+24:00 → Safe to decommission old API
```

---

### Phase 5: Monitoring Window (Week 9, Days 1-7)

**Duration:** 1 week  
**Traffic Split:** 100% new (old API still running read-only for emergency)  
**Risk Level:** Medium (monitoring for lurking issues)

**Process:**
1. Old API remains deployed (but not receiving traffic)
2. Monitoring continues 24/7 for data anomalies
3. Weekly reconciliation: Compare 7 days of customer records between old + new APIs
4. Any discrepancies investigated before old API decommissioned

**Success Criteria:**
- 7 days of 100% new API traffic, zero unplanned incidents
- Data audit: ≤0.01% discrepancies (acceptable noise)
- Team confidence high (vote to decommission old API)

---

### Phase 6: Decommission Old API (Week 10, Day 1)

**Duration:** 2 hours  
**Risk Level:** Low (old API no longer needed, redundant systems removed)

**Process:**
1. Shut down old `Holding Inquiry` → `Whatever` call chain
2. Remove feature flag (no longer needed)
3. Archive old API code + documentation for compliance/audit
4. Remove old API monitoring + alerts
5. Notify SfS consumers: "Migration complete, old path permanently retired"

**Post-Decommission:**
- Old code: Archive to GitHub/artifact store (compliance requirement: 7-year retention)
- Runbooks: Update SfS documentation to reference new APIs only
- Training: Deliver post-mortems + lessons learned to teams
- Cost: New distributed APIs reduce infrastructure costs by ≥20%

---

## Rollback Procedures

### Instant Rollback (Seconds)

**Trigger:** Automated alert (error rate, latency, circuit breaker)

**Action:**
```bash
# In production (instant, no restart)
feature_flag::set('route_to_new_api', false)

# All traffic immediately returns to old API
# Customers experience no interruption
```

**Verification:**
```bash
# Check traffic split
monitoring::get_traffic_split()
# Output: new_api=0%, old_api=100%

# Monitor error rate recovery
monitoring::get_error_rate('old_api')
# Should return to <0.05% within 30s
```

**Post-Rollback:**
1. Page on-call PM (why did rollback trigger?)
2. Investigate root cause
3. Assess whether to retry Phase 3 or escalate to Platform team
4. Decide: Retry (fix issue) or defer to Phase 4 (get more time)

---

### Full Rollback (If Decommission Happens Too Early)

**Trigger:** Data discrepancy found in Week 10, old API already decommissioned

**Risk Level:** High (old API may not restart cleanly after shutdown)

**Procedure:**
1. Activate disaster recovery: Restore old API from archived code + config
2. Run compatibility tests (does it still talk to LifePro?)
3. Re-enable in read-only mode (gather data, don't serve customers yet)
4. Compare data audit results with new API
5. Decide: Fix new API or escalate incident

**Timeline:** 2-4 hours (slow, high-risk)

**Prevention:** Don't decommission old API for 14 days (double the usual window)

---

## Monitoring Dashboard

### Real-Time Metrics

**SfS Cutover Dashboard**
```
┌─────────────────────────────────────────┐
│ Traffic Split                            │
├─────────────────────────────────────────┤
│ New API: [████░░░░░░░░░░░░░░░░] 10%     │
│ Old API: [██████████████░░░░░░░░] 90%   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Error Rate (Last 5 min)                 │
├─────────────────────────────────────────┤
│ New API: 0.08% (target: <0.1%)    ✓    │
│ Old API: 0.05% (baseline)         ✓    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Latency p95 (Last 5 min)                │
├─────────────────────────────────────────┤
│ New API: 487ms (target: <550ms)   ✓    │
│ Old API: 420ms (baseline)         ✓    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ LifePro Backend CPU                     │
├─────────────────────────────────────────┤
│ CPU: [████░░░░░░░░░░░░░░] 45%      ✓   │
│ Memory: [██░░░░░░░░░░░░░░] 15%     ✓   │
│ Connections: 145/200                ✓   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Cache Hit Ratio                         │
├─────────────────────────────────────────┤
│ Redis: [██████████░░░░░░░░] 72%    ✓   │
│ (Target: >70%)                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Circuit Breaker Status                  │
├─────────────────────────────────────────┤
│ LifePro: [GREEN] Healthy           ✓   │
│ Trips (24h): 0                     ✓   │
└─────────────────────────────────────────┘
```

### Alert Configuration

| Metric | Threshold | Severity | Action |
|--------|-----------|----------|--------|
| New API error rate | >0.5% | Page On-Call | Investigate within 5 min |
| New API latency p95 | >1000ms | Page On-Call | Investigate; consider rollback |
| LifePro CPU | >85% | Warn | Reduce cache TTL or throttle |
| Circuit breaker trips | >10 (5min) | Page On-Call | Instant rollback |
| Data audit discrepancy | >1% | Page On-Call | Stop cutover immediately |

---

## Escalation Procedure

### Tier 1: Integration Team (First Response)
- Monitor dashboard alerts
- Check current traffic split
- Assess whether to rollback immediately

### Tier 2: Platform Team (Debugging)
- If Tier 1 can't resolve in 5 min
- Investigate root cause (API code? LifePro backend? Network?)
- Decide: Quick fix or rollback

### Tier 3: VP Engineering (Executive Decision)
- If Tier 2 can't resolve in 30 min
- Decide: Defer cutover to next week, escalate to customer success

---

## Success Handoff

**When cutover is complete (Week 10, Day 7):**

1. ✅ **Decommission old API** (archives to compliance storage)
2. ✅ **Update documentation** (SfS docs point to new APIs)
3. ✅ **Train ops team** (post-mortem + lessons learned)
4. ✅ **Celebrate** (toast to successful refactoring!)
5. ✅ **Plan Phase 2** (next optimization: caching strategy improvements, async patterns)

---

**Status:** Ready for Deployment  
**Next Step:** Execute Week 5 Shadow Reads → begin Phase 3 cutover prep
