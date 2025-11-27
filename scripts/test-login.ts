
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
    console.log('Testing login for analyst@cdc-lims.local...');
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'analyst@cdc-lims.local',
        password: 'password123',
    });

    if (error) {
        console.error('Login failed:', error.message);
    } else {
        console.log('Login successful!');
        console.log('User ID:', data.user.id);
    }
}

testLogin();
