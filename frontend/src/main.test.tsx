import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlannerApp, RegistryTable } from "./main";

const token = "test-token";

function jsonResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
  } as Response);
}

function emptyResponse() {
  return Promise.resolve({
    ok: true,
    status: 204,
    json: () => Promise.resolve({})
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PlannerApp schedule workspace", () => {
  it("opens add/edit and recurring schedule sections from the sidebar in the main workspace", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/children")) {
        return jsonResponse([
          {
            id: 1,
            first_name: "Avery",
            college_start_date: "2026-01-01",
            college_end_date: "2026-12-31",
            account: {
              id: 10,
              initial_balance: "1000.00",
              expected_annual_return_rate: "0.06"
            }
          }
        ]);
      }
      if (url.startsWith("/api/registry/10")) {
        return jsonResponse({
          rows: [
            {
              date: "2026-01-01",
              description: "Opening balance",
              type: "opening_balance",
              amount: "0",
              running_balance: "1000.00",
              source_schedule_id: null,
              source_schedule_kind: null,
              original_date: null,
              override_id: null
            }
          ],
          groups: []
        });
      }
      if (url.startsWith("/api/schedules/deposits")) {
        return jsonResponse([
          {
            id: 20,
            account_id: 10,
            start_date: "2026-01-01",
            end_date: "2026-12-31",
            amount: "150.00",
            description: "Monthly contribution",
            frequency: "monthly",
            recurrence: {}
          }
        ]);
      }
      if (url.startsWith("/api/schedules/expenses")) {
        return jsonResponse([
          {
            id: 30,
            account_id: 10,
            start_date: "2026-08-01",
            end_date: "2026-08-01",
            amount: "5000.00",
            description: "Tuition",
            frequency: "one_time",
            recurrence: {}
          }
        ]);
      }
      return jsonResponse({});
    });

    render(<PlannerApp token={token} onLogout={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Add/edit expenses/deposits" }));

    const addHeading = await screen.findByRole("heading", { name: "Add expense/deposit" });
    expect(addHeading.closest(".workspace")).not.toBeNull();
    expect(addHeading.closest(".sidebar")).toBeNull();
    expect(screen.getByRole("button", { name: "Add/edit expenses/deposits" })).toHaveClass("active");

    fireEvent.click(screen.getByRole("button", { name: "Recurring schedules" }));

    const recurringHeading = await screen.findByRole("heading", { name: "Recurring deposits/expenses" });
    expect(recurringHeading.closest(".workspace")).not.toBeNull();
    expect(recurringHeading.closest(".sidebar")).toBeNull();
    expect(screen.getByRole("button", { name: "Recurring schedules" })).toHaveClass("active");
    expect(await screen.findByText("Monthly contribution")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Monthly contribution" }));

    expect(await screen.findByRole("heading", { name: "Edit expense/deposit" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Monthly contribution")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeInTheDocument();
  });
});

describe("RegistryTable amount editing", () => {
  it("shows expense amounts as signed values but sends a positive override amount when editing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => emptyResponse());
    const onSaved = vi.fn();

    render(
      <RegistryTable
        rows={[
          {
            date: "2026-12-20",
            description: "Adjusted tuition",
            type: "expense",
            amount: "-5300.00",
            running_balance: "2500.00",
            source_schedule_id: 42,
            source_schedule_kind: "expense",
            original_date: "2027-08-01",
            override_id: null
          }
        ]}
        groups={[]}
        dateSort="date_asc"
        onDateSortChange={vi.fn()}
        accountId={10}
        token={token}
        onSaved={onSaved}
      />
    );

    expect(screen.getByText("-$5,300.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Adjusted tuition on 2026-12-20" }));

    const row = screen.getByRole("row", { name: /Adjusted tuition/ });
    expect(within(row).getByDisplayValue("5300")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save occurrence" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [, request] = fetchMock.mock.calls[0];
    expect(fetchMock.mock.calls[0][0]).toBe("/api/schedules/occurrence-overrides");
    expect(JSON.parse(String(request?.body))).toMatchObject({
      account_id: 10,
      schedule_kind: "expense",
      schedule_id: 42,
      original_date: "2027-08-01",
      override_date: "2026-12-20",
      amount: "5300",
      description: "Adjusted tuition",
      is_deleted: false
    });
  });
});
