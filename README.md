## Backend Repository: Plenvo

### Project Overview
The backend for Plenvo, a Node.js-based API server, manages all hospital appointment data and communication between the frontend and the database. It supports secure and efficient handling of patients, doctors, and consultants.

---

### Features
- **Appointment Management**: CRUD operations for appointments.
- **Authentication**: Role-based access for doctors and consultants.
- **SMS Notifications**: Sends reminders for upcoming appointments.
- **File Uploads**: Doctors can upload patient files and notes.

---

### Technology Stack
- **Backend Framework**: Express.js
- **Database**: MongoDB (or your choice of database)
- **Authentication**: JWT (JSON Web Tokens)
- **SMS Integration**: Twilio (or an alternative provider)

---

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/FatihErdgn/plenvo-backend.git
   ```
2. Navigate to the project directory:
   ```bash
   cd plenvo-backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up environment variables:
   Create a `.env` file in the root directory and add the following:
   ```env
   PORT=5000
   DATABASE_URL=<your_database_url>
   JWT_SECRET=<your_jwt_secret>
   TWILIO_SID=<your_twilio_sid>
   TWILIO_AUTH_TOKEN=<your_twilio_auth_token>
   TWILIO_PHONE_NUMBER=<your_twilio_phone_number>
   ```
   Replace placeholders with your configuration.

5. Start the development server:
   ```bash
   npm run dev
   ```

---

### API Endpoints
| Method | Endpoint              | Description                       |
|--------|-----------------------|-----------------------------------|
| POST   | `/appointments`       | Create a new appointment          |
| GET    | `/appointments`       | Retrieve all appointments         |
| DELETE | `/appointments/:code` | Delete an appointment by code     |
| POST   | `/auth/login`         | Login for doctors and consultants |
| POST   | `/notifications/sms`  | Send SMS reminders                |

---

### Folder Structure
- `src/controllers`: API endpoint logic.
- `src/models`: Database models.
- `src/routes`: Routing setup for endpoints.
- `src/middleware`: Authentication and validation.

---

### Contributing
1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit changes:
   ```bash
   git commit -m "Add your feature"
   ```
4. Push to the branch:
   ```bash
   git push origin feature/your-feature
   ```
5. Open a pull request.

---

### License
This project is licensed under the [MIT License](LICENSE).
