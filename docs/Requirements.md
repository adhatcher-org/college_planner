## college_planner

Create an application with a web front end to help users create a college savings plan that includes showing a monthly balance including scheduled credits and debits based on user provided deposits and expenses. 

## Features the application should have

1. Ability to track one or more children
2. Start date and end dates of college for each child
3. Ability to add future expenditures.
   1. when creating new expenditures, you should be able to set the following characteristics
       1. Start date
       2. End Date
       3. Amount
       4. description
       5. Frequency of the expenditure (monthly, Yearly, Semi Yearly)
          1. For Semi-Annual expenditures, don't assume they are due every 6 months. Allow for semi-annual payments to be due in January and August for example
4. Ability to add reoccuring deposits
   1. Wen creating new deposits, you should be able to set the following characteristics:
      1. start date
      2. End date
      3. Amount
      4. Description
      5. Frequency (Monthly, every two weeks, Semi-monthly, quarterly, yearly, semi-yearly)
         1. For semi-yearly, don't assume every 6 months. Deposits might be in Jan and Aug (for example)
5. Expected Annual return rate on investments.
   1. The income from investments should be added to the monthly running account balances.
6. create a monthly account balance view (Registry), showing the date, description, amount of deposit or expense and running balance. This should include all deposits, expenses and extimated investnemt income.
    1. Allow the registry to be collapses by month/quarter or by year.  
       1. When collapsed, provide the following info: Time Period (May '26, Q1'26...), Total Deposits, Total Expenses, Total Income, Account Balance
    2. Registry should be sorted by
       1. Date in descending order
       2. deposits
       3. Expenses
       4. Description
    3. Registry shoudl have filters at the headers to allow the user to filter on Description, deposits, expenses, date range.
       1. I want to see all the deposits that are schdule for the account between Jan 1, 2026 and Mar 31, 2026
       2. I want to see all the expenses scheduled for 2026
7. This application will run on a docker container on my Unraid Server.  Create a docker-compose.yml file for all components required for the application.
   1. Any passwords, secrets, hostnames, connection strings.. should be kept in a .env file and not contained directly in the docker-compose.yml file.
8. The application should have monitoring and logging.  
    1. Monitoring should be available at the /metrics endpoint and will be scraped by prometheus and made available via grafana
    2. logs should be written to a /logs directory, which will be scraped by promtail and made available via Grafna and loki
9. The application should setup a default admin user with a password of "ChangeM3!". The admin user should be required to rest the password on the initial login.
10. The application should have the ability to reset a password via email.
11. Users account should have the following information:
    1. email (used as the account name)
    2. First Name
    3. Last Name
12. Users should be able to register 1 or more children
13. Child accounts should have the following info:
    1. Childs first name
    2. Childs College Start Date
    3. Childs College End Date (Default to 45 months after start date)
14. Connect to ollama to provide forecasting capabilities. These should include:
    1. When setting up a new child, after entering their start date and end date for college, ask if they would like help setting up a plan. If they ansewr yes:
       1. Ask how much they anticipate college costing each year.
       2. If they do not know how much to plan for, seach the web for the industry anticipated average out of pocket expense for a parent based no the college start and end dates.
          1. If income is needed to make the determination, ask for that but do not store it anywhere.
       3. Ask if they have any money currently saved for college.
       4. Based on the yearly cost of college, come up with a monthly savings plan showing how much they would need to save each month to allow them to pay for college based on the start and end dates and total yearly cost, minus any existing funds they have to apply towards college expenses.
       5. Ask if they with to contribute any one-time or yearly contributions, such as funds from bonuses, tax refunds.  If so, include these to the account balances and reduce the required monthly payments accordingly.
       6. Include an annual return of 6% on the account balance and include that in the forecast of required monthly contribution needed to pay for college.
       7. Allow the user to change the calculated monthly required contribution if they don't think they can afford that amount. This should result in a forecast of the amount of loans the parents and or child will be required to take out in order to cover the shortfall.

## Implementation status

The requirements above are the original ask and are kept as written. This section records where the
delivered application stands against them.

Delivered:

- 1, 2, 11, 12, 13. Multiple children per user, college start and end dates with the 45-month default
  end date, and user accounts keyed on email with first and last name.
- 3, 4. Deposits and expenses with start date, end date, amount, description, and frequency.
  Semi-yearly stores explicit months rather than assuming a six-month interval, and semi-monthly
  stores explicit days defaulting to the 1st and 15th. Both deposits and expenses accept the full
  frequency set, and a one-time frequency was added on top of the requested list.
- 5. Expected annual return rate per account, defaulting to 6%, with investment income added to the
  monthly running balance.
- 6, 6.1. The registry shows date, description, a single signed amount, and running balance, and
  collapses by month, quarter, or year with total deposits, total expenses, total income, and ending
  balance per period.
- 7. Runs on Docker with a `docker-compose.yml` covering the app and PostgreSQL, with all secrets,
  hostnames, and connection strings in `.env`.
- 8. `/metrics` for Prometheus and JSON logs written to `/logs` for Promtail.
- 9. The default admin is created on startup with the `ChangeM3!` password and is flagged for a
  required reset.
- 10. Password reset by email.

Delivered differently than described:

- 6.2. The registry defaults to date ascending with a header toggle to date descending, rather than
  defaulting to descending. Deposit, expense, and description sorts are available through the API.
- 6.3. Filters are in a toolbar above the table rather than in the column headers, and cover date
  range, a display start date, description search, and row type. Both example queries are supported.
- 9. The admin is flagged for a required reset and the login response reports it, but the frontend
  does not yet block access to the planner until the reset is done.
- 10. The reset email carries the token as text and the user pastes it into the reset form; there is
  no reset link.

Not yet delivered:

- 14. The forecasting flow exists only as a single backend endpoint, `POST /api/forecast`, with no
  user interface, so none of the conversational steps in 14.1 are in place. Within that endpoint:
  the monthly savings calculation (14.1.4), the 6% return assumption (14.1.6), and the override with
  a resulting shortfall or loan forecast (14.1.7) work; the web search (14.1.2) returns citations but
  does not yet yield a cost, falling back to a fixed placeholder; income is accepted transiently and
  never stored (14.1.2.1), but nothing consumes it; existing savings (14.1.3) are applied, and
  yearly contributions are applied, but one-time contributions (14.1.5) are stored without affecting
  the projection.

Delivered beyond the original list:

- Recording an actual observed balance on a date, which re-anchors the running balance.
- Editing, moving, or deleting a single projected occurrence without changing its schedule.
- Overriding or suppressing a month's projected investment income.
- A plan status of Successful, Loans Required, or Short Fall.
- An available-funds-by-month chart.
- Account maintenance: profile and email updates, password change, and account deletion.
