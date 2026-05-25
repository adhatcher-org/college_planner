# ADR-0003: Forecasting And Search Integration

## Status

Accepted

## Context

The requirements call for Ollama-based forecasting assistance. The assistant should help users create a plan, estimate college costs when they do not know them, account for existing savings, include one-time or yearly contributions, and calculate monthly savings needs. If income is needed to determine estimates, it should be requested but not stored.

Ollama can provide local reasoning and summaries, but it does not reliably provide current web data by itself.

## Decision

Use Ollama for local planning assistance and explanation. Use Brave Search API for current college-cost lookup when the user does not know what cost to enter.

The backend must perform deterministic financial calculations. The language model must not be the source of truth for balances, contribution amounts, or shortfall math.

## Rationale

This separates responsibilities cleanly:

- Brave Search API retrieves current source material.
- Ollama explains assumptions and generates human-readable planning guidance.
- Backend services calculate required monthly contributions and projected shortfalls.

This approach supports current estimates with citations while preserving deterministic, testable financial calculations.

## Consequences

- Brave Search API credentials must be configured through `.env`.
- Forecasting tests should mock both Ollama and Brave Search.
- Forecast results should include citations when search is used.
- The app must handle missing or unavailable search configuration gracefully.
- Sensitive transient values, such as income entered only to estimate cost, must not be persisted or logged.

## Implementation Notes

Forecast setup flow:

1. Ask whether the user wants help creating a plan.
2. Ask for expected yearly college cost.
3. If unknown, call Brave Search API for current estimates.
4. Ask for income only if needed for the estimate.
5. Do not store income.
6. Ask for existing college savings.
7. Ask for optional one-time or yearly contributions.
8. Use a 6% annual return by default.
9. Calculate required monthly savings.
10. Let the user override the monthly contribution.
11. Estimate loan need or shortfall if the selected monthly contribution is insufficient.

Ollama output should be treated as explanatory content. Store only non-sensitive forecast assumptions, calculated outputs, and citation metadata.

If Brave Search is unavailable, the app should ask the user to enter a cost assumption manually.

