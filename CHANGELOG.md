# Changelog

## Unreleased

### Changed

- Consolidated registry row amounts from separate deposit, expense, and investment income fields into a single `amount` field.
- Updated registry running balance, sorting, grouping, API tests, and frontend totals to use the unified amount model.
- Updated the registry table to display one `Amount` column.
- Increased chart left padding so y-axis currency labels are not clipped.
- Split schedule management into separate main-window sections for add/edit actions and recurring schedule lists, launched from the sidebar.
- Excluded vulnerable FastAPI `0.136.3` and refreshed the backend lockfile to resolve the CI security audit failure.
- Added frontend interaction tests for sidebar-launched schedule sections, recurring schedule edit handoff, and signed registry amount display with positive expense edit payloads.
- Configured Vitest with `jsdom` and Testing Library setup for component-level frontend tests.
