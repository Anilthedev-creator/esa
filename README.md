# ESA Engineering Services Australia

A full-stack web application for ESA Engineering, built with **Spring Boot 3** (Java 17) on the backend and plain **HTML / CSS / JavaScript** on the frontend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Spring Boot 3.2, Spring Data JPA |
| Database | PostgreSQL |
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6) |
| Build | Maven |

## Project Structure

```
├── java/                       # Spring Boot source code
│   └── com/esaengineering/
│       ├── config/             # CORS, database configuration
│       ├── controller/         # REST API controllers
│       ├── dto/                # Data transfer objects
│       ├── exception/          # Global error handling
│       ├── model/              # JPA entities
│       ├── repository/         # Data access layer
│       └── service/            # Business logic
├── resources/
│   ├── application.properties  # Spring Boot configuration
│   └── static/                 # Frontend assets (served by Spring Boot)
│       ├── css/                # Stylesheets
│       ├── images/             # Image assets
│       └── js/                 # Shared JavaScript modules
├── frontend/                   # Standalone frontend (same files, for local dev)
├── pom.xml                     # Maven build configuration
└── README.md
```

## Prerequisites

- **Java 17** or later
- **Maven 3.8+**
- **PostgreSQL 14+**

## Setup

### 1. Database

Create a PostgreSQL database:

```sql
CREATE DATABASE esa_database;
```

Update the credentials in `resources/application.properties`:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/esa_database
spring.datasource.username=your_username
spring.datasource.password=your_password
```

### 2. Build & Run

```bash
# Build the project
mvn clean package

# Run the application
mvn spring-boot:run
```

The application will start on **http://localhost:8080**.

### 3. Access the Site

| Page | URL |
|------|-----|
| Home | http://localhost:8080/index.html |
| Services | http://localhost:8080/services.html |
| Contact | http://localhost:8080/contact.html |
| Sign In | http://localhost:8080/signin.html |
| Admin Dashboard | http://localhost:8080/dashboard.html |

## API Endpoints

Website pages use the `/api` endpoints, the older endpoints still work too.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Customer sign up (returns token + user) |
| POST | `/api/auth/signin` | User sign in (returns token + user) |
| GET | `/api/auth/me` | Get current user (needs `Authorization: Bearer <token>`) |
| POST | `/api/auth/forgot-password` | Request a password reset link |
| POST | `/api/auth/reset-password` | Set a new password with a reset token |
| POST | `/api/bookings` | Create a booking from the booking page |
| GET | `/api/bookings/{id}` | Booking + payment details for the payment page |
| POST | `/api/enquiries` | Submit the contact page form |
| POST | `/api/payments/{id}/confirm` | Pay the consultation fee (demo checkout) |
| GET | `/api/content?slug=<page>` | Saved text changes for a public page |
| POST | `/api/analytics/track` | Page view tracking |
| GET | `/api/admin/stats` | Admin dashboard stats (admin only) |
| GET | `/api/admin/customers` | List customers (admin only) |
| GET | `/api/admin/enquiries` | List enquiries (admin only) |
| GET | `/api/admin/payments` | List payments (admin only) |
| GET/POST | `/api/admin/pages` | List / create CMS pages (admin only) |
| GET/PUT | `/api/admin/settings` | Read / save site settings (admin only) |
| GET | `/api/admin/analytics/activity` | Visits per day for the chart (admin only) |
| POST | `/auth/register` | Customer registration (plain text answer) |
| POST | `/auth/login` | User login (plain text answer) |
| POST | `/auth/create/admin` | Create an admin account |
| PUT | `/auth/change-password` | Change password (needs current password) |
| POST | `/bookings/create` | Create a booking |
| GET | `/bookings/get` | List all bookings |
| GET | `/bookings/id/{id}` | Get one booking |
| POST | `/contact/create` | Create an enquiry |
| GET | `/contact/get` | List all enquiries |
| GET/PUT | `/about` | Read / save all about page content |
| GET/PUT | `/about/story`, `/about/heading1`, ... | Read / save one about page field |
| GET/POST/DELETE | `/payments` | Basic payment CRUD |

## Default Admin Account

When the app starts for the first time it creates an admin account
so you can open the admin pages:

- **Email:** `admin@esa.com.au`
- **Password:** `Admin1234`

Sign in at http://localhost:8080/signin.html and you will be
sent to the admin dashboard. Please change the password afterwards.

## Features

- **Public pages**: Home, Services, Projects, About, Contact, Team
- **Service pages**: Appraisals, Commissioning, Dangerous Goods, Optimisation, Safety Standards, Waste Management
- **Client portal**: Sign in, Sign up, Dashboard, Settings, Payments
- **Admin panel**: Dashboard, Customers, Enquiries, Payments, Content Management, Analytics, Settings
- **Booking system**: Service booking with payment flow
- **CMS**: Editable page content through the admin panel

## License

Proprietary — ESA Engineering Services Australia.