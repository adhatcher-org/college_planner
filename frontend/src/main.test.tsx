import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountSettings, PlannerApp, RegistryTable } from "./main";

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
  cleanup();
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

    expect(await screen.findByText("Plan Status")).toBeInTheDocument();
    expect(screen.getByText("Successful")).toBeInTheDocument();

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
