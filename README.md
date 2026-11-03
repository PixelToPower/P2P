🚀 Project: P2P Chat App



Tech Stack: React (Frontend), Node.js & Express (Backend), MongoDB Atlas (Database), bcrypt & JWT (Security)


📅 Day 1: Setting the Base
Project Setup: Created the project folders for frontend (client) and backend (server) so everything stays clean and organized.

Database Connection: Learned how to link a Node.js backend to a cloud database (MongoDB Atlas) using Mongoose.

Environment Variables: Learned how to safely store sensitive database password keys inside a .env file instead of putting them directly in the code.

📅 Day 2: User Models & Port Tweaks
Mongoose Schema: Built the blueprint (schema) for users, defining rules for storing usernames, emails, and passwords.

Fixing Port Conflicts: Discovered that macOS uses port 5000 for AirPlay, so we moved our backend server to run smoothly on port 5001.

Branch Cleanup: Cleaned up Git setup and set master as the primary default branch for the repository.

📅 Day 3: Password Hashing & Signup API
Password Hashing: Learned that storing plain passwords is dangerous, so we used bcrypt to turn user passwords into secure, unreadable hash text.

Signup Route: Created the POST /api/auth/signup API endpoint that receives new user data, encrypts the password, and saves them to MongoDB.

API Testing: Tested the endpoint using Thunder Client inside VS Code and successfully got back a 201 Created status!

📅 Day 4: Git Workflow & Prep for Login
Full-Stack Git Tracking: Learned how to stage, commit, and push both the backend server and frontend client folders together to GitHub.

Branch Switching: Learned how Git default branches work (main vs master) and how to update repository settings properly on GitHub.

Login & JWT Prep: Prepped the next step for backend development: checking user passwords during login and generating secure JSON Web Tokens (JWT) for login sessions.
