import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountSettings, AvailableFundsChart, PlannerApp, RegistryTable, type RegistryRow } from "./main";

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

function localToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("PlannerApp schedule workspace", () => {
  it("opens add/edit and recurring schedule sections from the sidebar in the main workspace", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/registry/10/balance-adjustments")) {
        return jsonResponse([
          {
            id: 99,
            account_id: 10,
            adjustment_date: "2000-03-15",
            balance: "1200.00",
            description: "Actual balance update"
          }
        ]);
      }
      if (url.startsWith("/api/children")) {
        return jsonResponse([
          {
            id: 1,
            first_name: "Avery",
            college_start_date: "2999-01-01",
            college_end_date: "3003-12-31",
            account: {
              id: 10,
              initial_balance: "1000.00",
              expected_annual_return_rate: "0.06"
            }
          }
        ]);
      }
      if (url.startsWith("/api/auth/me")) {
        return jsonResponse({
          id: 1,
          email: "parent@example.com",
          first_name: "Parent",
          last_name: "User",
          role: "user",
          force_password_reset: false
        });
      }
      if (url.startsWith("/api/registry/10")) {
        const parsedUrl = new URL(url, "http://localhost");
        if (parsedUrl.searchParams.get("start_date") !== "2999-01-01") {
          return jsonResponse({
            rows: [
              {
                date: "2000-03-15",
                description: "Opening balance",
                type: "opening_balance",
                amount: "0",
                running_balance: "1200.00",
                source_schedule_id: null,
                source_schedule_kind: null,
                original_date: null,
                override_id: null
              },
              {
                date: "2000-05-01",
                description: "Monthly contribution",
                type: "deposit",
                amount: "100.00",
                running_balance: "1300.00",
                source_schedule_id: 20,
                source_schedule_kind: "deposit",
                original_date: "2000-05-01",
                override_id: null
              },
              {
                date: "2000-08-01",
                description: "Tuition",
                type: "expense",
                amount: "-500.00",
                running_balance: "1100.00",
                source_schedule_id: 30,
                source_schedule_kind: "expense",
                original_date: "2000-08-01",
                override_id: null
              },
              {
                date: "2000-12-31",
                description: "Projected investment income",
                type: "investment_income",
                amount: "50.00",
                running_balance: "1150.00",
                source_schedule_id: null,
                source_schedule_kind: null,
                original_date: null,
                override_id: null
              }
            ],
            groups: [],
            plan_status: "Successful"
          });
        }
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
          groups: [],
          plan_status: "Successful"
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

    const metrics = await screen.findByLabelText("Account totals");
    expect(within(metrics).getByText("Plan Status")).toBeInTheDocument();
    expect(within(metrics).getByText("Successful")).toBeInTheDocument();
    expect(within(metrics).getByText("Current balance")).toBeInTheDocument();
    expect(within(metrics).getByText("Balance before first expense")).toBeInTheDocument();
    expect(within(metrics).getByText("Projected ending balance")).toBeInTheDocument();
    expect(within(metrics).getByText("Planned investment income")).toBeInTheDocument();
    expect(within(metrics).getByText("Planned expenses")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([requestUrl]) =>
        String(requestUrl).startsWith("/api/registry/10/balance-adjustments")
      )
    ).toBe(true);

    fireEvent.click(await screen.findByRole("button", { name: "Add/edit expenses/deposits" }));

    const addHeading = await screen.findByRole("heading", { name: "Add expense/deposit" });
    expect(addHeading.closest(".workspace")).not.toBeNull();
    expect(addHeading.closest(".sidebar")).toBeNull();
    expect(screen.getByRole("button", { name: "Add/edit expenses/deposits" })).toHaveClass("active");
    expect(screen.getByLabelText("Start")).toHaveValue(localToday());
    expect(screen.getByLabelText("End")).toHaveValue("2999-04-30");
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "expenses" } });
    expect(screen.getByLabelText("Start")).toHaveValue("2999-01-01");

    fireEvent.click(screen.getByRole("button", { name: "Recurring schedules" }));

    const recurringHeading = await screen.findByRole("heading", { name: "Recurring deposits/expenses" });
    expect(recurringHeading.closest(".workspace")).not.toBeNull();
    expect(recurringHeading.closest(".sidebar")).toBeNull();
    expect(screen.getByRole("button", { name: "Recurring schedules" })).toHaveClass("active");
    expect((await screen.findAllByText("Monthly contribution")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Edit Monthly contribution" }));

    expect(await screen.findByRole("heading", { name: "Edit expense/deposit" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Monthly contribution")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeInTheDocument();
  });

  it("shows N/A before first expense and uses today as summary start when there is no past balance adjustment", async () => {
    const today = localToday();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/children")) {
        return jsonResponse([
          {
            id: 1,
            first_name: "Avery",
            college_start_date: "2026-08-01",
            college_end_date: "2026-12-31",
            account: {
              id: 10,
              initial_balance: "1000.00",
              expected_annual_return_rate: "0.06"
            }
          }
        ]);
      }
      if (url.startsWith("/api/auth/me")) {
        return jsonResponse({
          id: 1,
          email: "parent@example.com",
          first_name: "Parent",
          last_name: "User",
          role: "user",
          force_password_reset: false
        });
      }
      if (url.startsWith("/api/registry/10/balance-adjustments")) {
        return jsonResponse([]);
      }
      if (url.startsWith("/api/registry/10")) {
        return jsonResponse({
          rows: [
            {
              date: today,
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
          groups: [],
          plan_status: "Successful"
        });
      }
      if (url.startsWith("/api/schedules/deposits") || url.startsWith("/api/schedules/expenses")) {
        return jsonResponse([]);
      }
      return jsonResponse({});
    });

    render(<PlannerApp token={token} onLogout={vi.fn()} />);

    expect(await screen.findByText("Balance before first expense")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([requestUrl]) => String(requestUrl).includes(`start_date=${today}`))).toBe(true);
  });

  it("falls back gracefully when balance-adjustments lookup fails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
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
      if (url.startsWith("/api/auth/me")) {
        return jsonResponse({
          id: 1,
          email: "parent@example.com",
          first_name: "Parent",
          last_name: "User",
          role: "user",
          force_password_reset: false
        });
      }
      if (url.startsWith("/api/registry/10/balance-adjustments")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ detail: "failed" })
        } as Response);
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
          groups: [],
          plan_status: "Successful"
        });
      }
      if (url.startsWith("/api/schedules/deposits") || url.startsWith("/api/schedules/expenses")) {
        return jsonResponse([]);
      }
      return jsonResponse({});
    });

    render(<PlannerApp token={token} onLogout={vi.fn()} />);

    expect(await screen.findByText("Plan Status")).toBeInTheDocument();
    expect(screen.getByText("Successful")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it("uses earliest schedule start date for registry range", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/children")) {
        return jsonResponse([
          {
            id: 1,
            first_name: "Avery",
            college_start_date: "2051-08-01",
            college_end_date: "2055-05-31",
            account: {
              id: 10,
              initial_balance: "1000.00",
              expected_annual_return_rate: "0.06"
            }
          }
        ]);
      }
      if (url.startsWith("/api/auth/me")) {
        return jsonResponse({
          id: 1,
          email: "parent@example.com",
          first_name: "Parent",
          last_name: "User",
          role: "user",
          force_password_reset: false
        });
      }
      if (url.startsWith("/api/schedules/deposits")) {
        return jsonResponse([]);
      }
      if (url.startsWith("/api/schedules/expenses")) {
        return jsonResponse([
          {
            id: 30,
            account_id: 10,
            start_date: "2020-08-01",
            end_date: "2055-05-31",
            amount: "5000.00",
            description: "Tuition",
            frequency: "semi_yearly",
            recurrence: { months: [1, 8], day: 1 }
          }
        ]);
      }
      if (url.startsWith("/api/registry/10/balance-adjustments")) {
        return jsonResponse([]);
      }
      if (url.startsWith("/api/registry/10")) {
        return jsonResponse({
          rows: [
            {
              date: "2020-08-01",
              description: "Tuition",
              type: "expense",
              amount: "-5000.00",
              running_balance: "-4000.00",
              source_schedule_id: 30,
              source_schedule_kind: "expense",
              original_date: "2020-08-01",
              override_id: null
            }
          ],
          groups: [],
          plan_status: "Loans Required"
        });
      }
      return jsonResponse({});
    });

    render(<PlannerApp token={token} onLogout={vi.fn()} />);

    expect(await screen.findByText("Plan Status")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([requestUrl]) =>
        String(requestUrl).includes("/api/registry/10?start_date=2020-08-01")
      )
    ).toBe(true);
  });
});

describe("AccountSettings", () => {
  const user = {
    id: 1,
    email: "parent@example.com",
    first_name: "Parent",
    last_name: "User",
    role: "user",
    force_password_reset: false
  };

  it("updates profile, email, and password through account settings", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => jsonResponse(user));
    const onUserChanged = vi.fn().mockResolvedValue(user);

    render(<AccountSettings token={token} user={user} onUserChanged={onUserChanged} onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Account settings" }));
    expect(screen.getByDisplayValue("Parent")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onUserChanged).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/me");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      first_name: "Updated",
      last_name: "User"
    });

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getAllByLabelText("Current password")[0], { target: { value: "ChangeM3!Now" } });
    fireEvent.click(screen.getByRole("button", { name: "Update email" }));
    await waitFor(() => expect(onUserChanged).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/me");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      email: "new@example.com",
      current_password: "ChangeM3!Now"
    });

    const passwordFields = screen.getAllByLabelText("Current password");
    fireEvent.change(passwordFields[1], { target: { value: "ChangeM3!Now" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "ChangeM3!Later" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toBe("/api/auth/change-password");
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({
      current_password: "ChangeM3!Now",
      new_password: "ChangeM3!Later"
    });
  });

  it("deletes the account and clears the session after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => emptyResponse());
    const onDeleted = vi.fn();

    render(<AccountSettings token={token} user={user} onUserChanged={vi.fn()} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole("button", { name: "Account settings" }));
    const passwordFields = screen.getAllByLabelText("Current password");
    fireEvent.change(passwordFields[2], { target: { value: "ChangeM3!Now" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/me");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      current_password: "ChangeM3!Now"
    });
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

describe("AvailableFundsChart", () => {
  it("renders a zero baseline and switches to negative styling when balances drop below zero", () => {
    const chartRows: RegistryRow[] = [
      ["2026-01-01", "1000.00"],
      ["2026-02-01", "1050.00"],
      ["2026-03-01", "1100.00"],
      ["2026-04-01", "1150.00"],
      ["2026-05-01", "1200.00"],
      ["2026-06-01", "-1000.00"],
      ["2026-07-01", "-950.00"],
      ["2026-08-01", "-900.00"]
    ].map(([date, runningBalance], index) => ({
      date,
      description: index === 5 ? "Expense" : "Balance",
      type: index === 5 ? "expense" : "opening_balance",
      amount: index === 5 ? "-2200.00" : "0",
      running_balance: runningBalance,
      source_schedule_id: index === 5 ? 1 : null,
      source_schedule_kind: index === 5 ? "expense" : null,
      original_date: index === 5 ? date : null,
      override_id: null
    }));

    const { container } = render(
      <AvailableFundsChart
        rows={chartRows}
      />
    );

    expect(container.querySelector(".chart-zero-axis")).not.toBeNull();
    expect(container.querySelector(".chart-line-positive")).not.toBeNull();
    expect(container.querySelector(".chart-line-negative")).not.toBeNull();
    expect(container.querySelector(".chart-line-negative-hidden")).toBeNull();
    expect(container.querySelector("polyline.chart-line-positive")?.getAttribute("clip-path")).toBe("url(#line-above-zero)");
    expect(container.querySelector("polyline.chart-line-negative")?.getAttribute("clip-path")).toBe("url(#line-below-zero)");
    expect(container.querySelector(".chart-point-negative")).not.toBeNull();
    expect(container.querySelector(".chart-point-positive")).not.toBeNull();
    expect(container.querySelector(".chart-balance-label")).not.toBeNull();
    expect(container.querySelector(".chart-balance-label-negative")).not.toBeNull();
    expect(container.querySelectorAll(".chart-balance-label").length).toBeLessThan(
      container.querySelectorAll(".chart-point").length
    );
  });
});
