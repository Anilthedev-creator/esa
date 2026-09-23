# ESA Engineering Services Australia

A full-stack web application for ESA Engineering, built with **Spring Boot 3** (Java 17) on the backend and plain **HTML / CSS / JavaScript** on the frontend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Spring Boot 3.2, Spring Data JPA |
| Database | PostgreSQL |
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6) |
| Build | Maven |

## Project Structure (clean main)

```
├── src/
│   └── main/
│       ├── java/com/esaengineering/   # Spring Boot source code
│       │   ├── config/                # CORS, database configuration
│       │   ├── controller/            # REST API controllers
│       │   ├── dto/                   # Data transfer objects
│       │   ├── exception/             # Global error handling
│       │   ├── model/                 # JPA entities
│       │   ├── repository/            # Data access layer
│       │   └── service/               # Business logic
│       └── resources/
│           ├── application.properties # Spring Boot configuration
│           └── static/                # Frontend assets (served by Spring Boot)
│               ├── css/               # Stylesheets
│               ├── images/            # Image assets
│               └── js/                # Shared JavaScript modules
├── pom.xml                            # Maven build configuration
└── README.md
```

> This is the **real main** — single source of truth.  
> Old duplicate folders (`frontend/`, `java/`, `resources/` at root, root `tracking.js`) have been removed and merged into the standard Maven layout `src/main/...`.

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

Update the credentials in `src/main/resources/application.properties`:

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Customer registration |
| POST | `/auth/signin` | User sign in |
| GET | `/auth/me` | Get current user |
| POST | `/contact` | Submit contact form |
| POST | `/bookings` | Create a booking |
| GET | `/api/admin/stats` | Admin dashboard stats |
| GET | `/api/admin/customers` | List customers |
| GET | `/api/admin/enquiries` | List enquiries |

## Features

- **Public pages**: Home, Services, Projects, About, Contact, Team
- **Service pages**: Appraisals, Commissioning, Dangerous Goods, Optimisation, Safety Standards, Waste Management
- **Client portal**: Sign in, Sign up, Dashboard, Settings, Payments
- **Admin panel**: Dashboard, Customers, Enquiries, Payments, Content Management, Analytics, Settings
- **Booking system**: Service booking with payment flow
- **CMS**: Editable page content through the admin panel

## Cleanup Notes

- Removed duplicate `frontend/` folder — now served from `src/main/resources/static/`
- Removed root `tracking.js` (now only `static/tracking.js`)
- Removed junk files: `src/main/java/.../service/Main.java` (empty), `static/createAdmin.java` (Java file in static)
- Converted custom `pom.xml` layout (`<sourceDirectory>java</sourceDirectory>`) to standard Maven layout
- Single branch `main` is now the production-ready structure

## License

Proprietary — ESA Engineering Services Australia.
