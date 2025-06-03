
-- User profiles table
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subscription_status TEXT DEFAULT 'free',
    subscription_start_date TIMESTAMP WITH TIME ZONE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    payment_method TEXT,
    join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    totp_secret TEXT,
    totp_enabled BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User progress tracking table
CREATE TABLE user_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_streak INTEGER DEFAULT 0,
    total_days INTEGER DEFAULT 0,
    habits_completed JSONB DEFAULT '{}',
    audio_progress JSONB DEFAULT '{}',
    video_progress JSONB DEFAULT '{}',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User routines table
CREATE TABLE user_routines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    activity_name TEXT NOT NULL,
    activity_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Daily progress tracking
CREATE TABLE daily_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    routine_created BOOLEAN DEFAULT FALSE,
    audio_listened BOOLEAN DEFAULT FALSE,
    video_watched BOOLEAN DEFAULT FALSE,
    exercise_completed BOOLEAN DEFAULT FALSE,
    meditation_done BOOLEAN DEFAULT FALSE,
    reading_done BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Audio progress tracking
CREATE TABLE audio_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    track_name TEXT NOT NULL,
    action TEXT NOT NULL, -- 'started', 'paused', 'completed', 'downloaded'
    "current_time" DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video progress tracking
CREATE TABLE video_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    video_name TEXT NOT NULL,
    action TEXT NOT NULL, -- 'started', 'paused', 'completed'
    "current_time" DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users during signup" ON profiles;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies for user_progress
CREATE POLICY "Users can view own progress" ON user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON user_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for user_routines
CREATE POLICY "Users can view own routines" ON user_routines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own routines" ON user_routines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own routines" ON user_routines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own routines" ON user_routines FOR DELETE USING (auth.uid() = user_id);

-- Policies for daily_progress
CREATE POLICY "Users can view own daily progress" ON daily_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own daily progress" ON daily_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily progress" ON daily_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for audio_progress
CREATE POLICY "Users can view own audio progress" ON audio_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audio progress" ON audio_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for video_progress
CREATE POLICY "Users can view own video progress" ON video_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own video progress" ON video_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin management tables
CREATE TABLE admin_secrets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    secret TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Admin content management tables
CREATE TABLE admin_audio_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    duration TEXT NOT NULL,
    narrator TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT NOT NULL
);

CREATE TABLE admin_video_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('free', 'premium')),
    icon TEXT NOT NULL,
    video_url TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT NOT NULL
);

CREATE TABLE admin_journey_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT NOT NULL
);

-- Notification system
CREATE TABLE admin_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('all', 'premium', 'free', 'specific')),
    recipient_email TEXT,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE user_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    admin_notification_id UUID REFERENCES admin_notifications(id)
);

-- RLS policies for admin tables
ALTER TABLE admin_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audio_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_video_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_journey_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Note: Admin tables will be accessible through service role key in admin panel
-- User notifications policy
CREATE POLICY "Users can view own notifications" ON user_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON user_notifications FOR UPDATE USING (auth.uid() = user_id);

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, created_at, subscription_status, join_date)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    NOW(),
    'free',
    NOW()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Indexes for better performance
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_routines_user_id ON user_routines(user_id);
CREATE INDEX idx_daily_progress_user_date ON daily_progress(user_id, date);
CREATE INDEX idx_audio_progress_user_track ON audio_progress(user_id, track_name);
CREATE INDEX idx_video_progress_user_video ON video_progress(user_id, video_name);
CREATE INDEX idx_admin_notifications_recipient ON admin_notifications(recipient_type, recipient_email);
CREATE INDEX idx_user_notifications_user_read ON user_notifications(user_id, is_read);
CREATE INDEX idx_admin_secrets_active ON admin_secrets(is_active);
