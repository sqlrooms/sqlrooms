# Canary calibration

Release thresholds are intentionally absent until the nightly canary has about
two weeks of retained history. The observatory read model computes pass rate per
scenario and per check, partitioned by model ID and pinned revision. It does
not collapse canary and production-model runs into one baseline.

During calibration, classify each failed run as model variability, upstream
provider failure, harness defect, profile defect, or behavioral regression.
Keep narration/semantic quality diagnostic unless observed variance shows it is
stable enough for release use. Structural state/policy checks are the first
candidates for release criteria.

For a model upgrade, run old and new pinned revisions concurrently through an
overlap window. Do not rename the new revision to the old baseline or silently
merge their histories. Release/manual production-model evidence remains a
separate cohort from the DeepSeek nightly canary.
