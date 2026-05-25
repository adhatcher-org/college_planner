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
