# Changelog

## Unreleased

### Changed

- Consolidated registry row amounts from separate deposit, expense, and investment income fields into a single `amount` field.
- Updated registry running balance, sorting, grouping, API tests, and frontend totals to use the unified amount model.
- Updated the registry table to display one `Amount` column.
- Increased chart left padding so y-axis currency labels are not clipped.
- Split schedule management into separate main-window sections for add/edit actions and recurring schedule lists, launched from the sidebar.
