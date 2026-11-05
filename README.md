# ReliefMS — Smart Teacher Relief Management System

**A cloud-based school management application for organizing teacher timetables, tracking absences, and assigning substitute teachers efficiently.**

ReliefMS simplifies the process of managing teacher absences and arranging temporary relief assignments. Instead of manually checking timetables and teacher availability, school administrators can manage the process through a centralized web application.

Built with **React, TypeScript, Tailwind CSS, and Supabase**, ReliefMS focuses on making daily school operations more organized, efficient, and accessible.

### Live Application

**[Explore ReliefMS](https://teacher-relief-management-system.pages.dev/)**

**[GitHub Repository](https://github.com/Jegathayini/Teacher-Relief-Management-System)**

---

## Overview

When teachers are absent, school administrators must identify available teachers, check scheduling conflicts, and arrange suitable substitutes.

Managing this process manually can be time-consuming, particularly in schools with multiple grades, classes, and teaching periods.

**ReliefMS provides a digital solution** that brings teacher management, timetable scheduling, absence tracking, and relief assignments together in one application.

## Key Features

### Teacher Management

- Add and manage teacher profiles.
- Assign subjects to individual teachers.
- Maintain active and inactive teacher status.
- View teacher information in a centralized interface.

### Timetable Management

- Create and manage weekly teacher timetables.
- Support five school days and eight periods per day.
- Record teaching periods and free periods.
- Track timetable completion through a guided 40-period wizard.
- Edit or delete existing timetable entries.
- Prevent scheduling conflicts.

### Teacher Absence Management

- Record daily teacher absences.
- View absence records by date.
- Identify lessons affected by absent teachers.
- Maintain historical absence information.

### Smart Relief Assignment

- Identify teachers available during affected periods.
- Suggest suitable relief teachers based on availability and assignment history.
- Avoid conflicting relief assignments.
- Record and manage temporary relief assignments.
- Track relief workload to support fairer distribution.

### Dashboard and Reports

- View teacher and absence statistics.
- Monitor completed and pending relief assignments.
- Track daily, monthly, and annual relief information.
- Generate printable school summaries.
- Maintain lifetime relief assignment counts.

### Academic Year Management

- Maintain academic-year information.
- Archive timetable records when transitioning between academic years.
- Preserve teacher profiles and historical relief records.
- Prepare new-year timetable schedules.

*Note: The academic-year rollover feature is implemented but is undergoing final validation before production use.*

### Cloud-Based Data Management

- Store application data in Supabase PostgreSQL.
- Support authenticated school administration.
- Organize data by school.
- Access the deployed application through a web browser.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Programming Language | TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Database Operations | PostgreSQL Functions / Supabase RPC |
| Hosting | Cloudflare Pages |
| Version Control | Git & GitHub |

## System Workflow

```text
School Administrator
        |
        v
   ReliefMS Dashboard
        |
        +---- Teacher Management
        |
        +---- Timetable Management
        |          |
        |          +---- Teaching Periods
        |          +---- Free Periods
        |
        +---- Absence Management
        |          |
        |          v
        |    Affected Lessons
        |          |
        |          v
        |    Relief Suggestions
        |          |
        |          v
        |    Relief Assignments
        |
        +---- Reports & Statistics
        |
        +---- Academic Year Management
        |
        v
   Supabase PostgreSQL
```

## Getting Started

### Prerequisites

Make sure you have installed:

- Node.js and npm
- Git
- A code editor such as Visual Studio Code

You will also need a Supabase project configured with the application's database schema, authentication, policies, and PostgreSQL functions.

### 1. Clone the Repository

```bash
git clone https://github.com/Jegathayini/Teacher-Relief-Management-System.git
cd Teacher-Relief-Management-System
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file inside the `frontend` directory.

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

Use the variable names expected by your project's Supabase client configuration.

Never commit private credentials or Supabase service-role keys to GitHub.

### 4. Start the Development Server

```bash
npm run dev
```

Open the local URL displayed in your terminal.

### 5. Build for Production

```bash
npm run build
```

The production-ready frontend will be generated in the `dist` directory.

---

## Project Structure

```text
Teacher-Relief-Management-System/
|
+-- frontend/
|   |
|   +-- src/
|   |   +-- components/
|   |   +-- pages/
|   |   +-- services/
|   |   +-- lib/
|   |   +-- types/
|   |
|   +-- public/
|   +-- package.json
|   +-- vite.config.ts
|
+-- README.md
```

*This is a simplified overview of the main frontend structure.*

## Deployment

ReliefMS is deployed using **Cloudflare Pages**, with **Supabase** providing cloud database and authentication services.

**Live Website:** https://teacher-relief-management-system.pages.dev/

The deployed application requires authorized access to school administration features.

## Development Journey

ReliefMS was developed through an iterative learning and implementation process, beginning with frontend fundamentals and progressing toward a cloud-connected school management application.

Major development stages included:

1. Requirements analysis and system planning.
2. Learning React, TypeScript, and Tailwind CSS.
3. Designing reusable components and interfaces.
4. Implementing teacher and timetable management.
5. Developing absence tracking and relief assignment logic.
6. Integrating Supabase PostgreSQL and authentication.
7. Implementing reporting and academic-year management.
8. Testing, debugging, and deploying the application.

## Future Improvements

- Enhanced reporting and data visualization.
- Improved mobile responsiveness and accessibility.
- Additional administrative controls.
- More advanced relief workload analysis.
- Further automation of routine scheduling tasks.

## Developer

**Jegathayini Thiruchchelvam**  
Computer Science & Engineering Undergraduate  
University of Moratuwa, Sri Lanka

**GitHub:** [@Jegathayini](https://github.com/Jegathayini)

---

### Project Status

**Deployed — Ongoing Testing and Improvements**

ReliefMS is an evolving project developed to explore practical school management challenges through modern web technologies.

---

*Built with a focus on practical problem-solving, continuous learning, and making school administration more efficient.*
