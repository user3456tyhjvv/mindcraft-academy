
# MindCraft Academy

🧠 **Transform Your Mind, Craft Your Success** 

A comprehensive personal development platform built with modern web technologies and real-time user progress tracking.

## 🌟 Features

- **🔐 Secure Authentication** - Email verification & password reset with Supabase
- **📱 Two-Factor Authentication** - TOTP setup with QR codes for enhanced security
- **🎵 Audio Library** - Curated mindfulness and motivation content
- **🎬 Video Content** - Educational videos with premium access tiers
- **📅 Daily Routine Builder** - Customize your perfect daily schedule
- **📊 Progress Tracking** - Real-time habit monitoring and streak tracking
- **👨‍💼 Admin Panel** - Content management and user analytics
- **🔔 Notification System** - User engagement and admin communications
- **💳 Subscription Management** - Free and premium tier support

## 🛠 Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with Row Level Security
- **2FA**: TOTP with QR Code generation
- **Hosting**: Replit Deployment
- **Version Control**: Git & GitHub

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/mindcraft-academy.git
   ```

2. **Set up Supabase**
   - Create a new Supabase project
   - Run the SQL schema from `supabase_schema.sql`
   - Update the Supabase credentials in `script.js` and `admin-script.js`

3. **Deploy on Replit**
   - Import your GitHub repository to Replit
   - The site will automatically deploy as a static website

## 🏗 Database Structure

- **profiles** - User account information and subscription status
- **user_progress** - Daily habit tracking and streaks
- **user_routines** - Personalized daily schedules
- **daily_progress** - Date-specific progress tracking
- **audio_progress** & **video_progress** - Media consumption tracking
- **admin_*** tables - Content management and notifications

## 🔒 Security Features

- Row Level Security (RLS) policies for all database tables
- TOTP-based two-factor authentication for admin access
- Secure session management with Supabase Auth
- Email verification for new accounts

## 📱 User Experience

- **Responsive Design** - Works seamlessly on desktop and mobile
- **Progressive Web App** features for mobile installation
- **Real-time Updates** - Live progress tracking and notifications
- **Offline Support** - Core features available without internet

## 🎯 Use Cases

- Personal development tracking
- Daily routine optimization
- Mindfulness and meditation guidance
- Educational content consumption
- Habit formation and monitoring

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

---

**Built with ❤️ by [Your Name]**
