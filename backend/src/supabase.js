const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mbpsgdvyawgxeoamkqru.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icHNnZHZ5YXdneGVvYW1rcXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1NDgyNzgsImV4cCI6MjEwMjEyNDI3OH0.swt3DjIEUNwQDgqhk4I8F8SBRtS9pQU5oOUTBi51W6Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = supabase;
