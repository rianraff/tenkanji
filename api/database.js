const { createClient } = require('@supabase/supabase-js');

// On Vercel, these are provided by the environment settings
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL ERROR: Supabase URL or Key is missing from Environment Variables.');
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.error('CRITICAL ERROR: Failed to initialize Supabase client:', err.message);
  }
}

module.exports = { supabase };
