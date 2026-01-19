import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000'
const serviceRoleKey = process.env.SERVICE_ROLE_KEY

if (!serviceRoleKey) {
    console.error('ERROR: SERVICE_ROLE_KEY environment variable is required.')
    console.error('Usage: SERVICE_ROLE_KEY=your_key node update-passwords.mjs')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

const users = [
    {
        id: 'a0000000-0000-0000-0000-000000000001',
        email: 'analyst@cdc-lims.local',
        password: 'password123'
    },
    {
        id: 'b0000000-0000-0000-0000-000000000001',
        email: 'manager@cdc-lims.local',
        password: 'password123'
    }
]

async function updateUserPassword(user) {
    try {
        const { data, error } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: user.password }
        )

        if (error) {
            console.log(`✗ Failed to update ${user.email}:`, error.message)
            return false
        }

        console.log(`✓ Updated password for: ${user.email}`)
        return true
    } catch (err) {
        console.error(`✗ Error updating ${user.email}:`, err.message)
        return false
    }
}

async function main() {
    console.log('Updating test user passwords...\n')

    for (const user of users) {
        await updateUserPassword(user)
    }

    console.log('\n====================================')
    console.log('TEST USER CREDENTIALS')
    console.log('====================================')
    console.log('Analyst Account:')
    console.log('  Username: analyst')
    console.log('  Email: analyst@cdc-lims.local')
    console.log('  Password: password123')
    console.log('')
    console.log('Manager Account:')
    console.log('  Username: manager')
    console.log('  Email: manager@cdc-lims.local')
    console.log('  Password: password123')
    console.log('====================================')
}

main()
