// Script to create test users via Supabase Auth API
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000'
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
    console.error('ERROR: SERVICE_ROLE_KEY environment variable is required.')
    console.error('Usage: SERVICE_ROLE_KEY=your_key node create-test-users.js')
    process.exit(1)
}

const users = [
    {
        id: 'a0000000-0000-0000-0000-000000000001',
        email: 'analyst@cdc-lims.local',
        password: 'password123',
        email_confirm: true
    },
    {
        id: 'b0000000-0000-0000-0000-000000000001',
        email: 'manager@cdc-lims.local',
        password: 'password123',
        email_confirm: true
    }
]

async function createUser(user) {
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
            method: 'POST',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: user.id,
                email: user.email,
                password: user.password,
                email_confirm: user.email_confirm
            })
        })

        const data = await response.json()

        if (response.ok) {
            console.log(`✓ Created user: ${user.email}`)
            return data
        } else {
            console.log(`✗ Failed to create ${user.email}:`, data.msg || data.message || JSON.stringify(data))
            return null
        }
    } catch (error) {
        console.error(`✗ Error creating ${user.email}:`, error.message)
        return null
    }
}

async function main() {
    console.log('Creating test users...\n')

    for (const user of users) {
        await createUser(user)
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
