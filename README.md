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