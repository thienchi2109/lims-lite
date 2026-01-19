const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
    console.error('ERROR: JWT_SECRET environment variable is required.')
    console.error('Usage: JWT_SECRET=your_secret node generate-jwt-keys.js')
    process.exit(1)
}

// Generate ANON key
const anonToken = jwt.sign(
    {
        iss: 'supabase',
        ref: 'localhost',
        role: 'anon',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 years
    },
    JWT_SECRET
)

// Generate SERVICE_ROLE key
const serviceRoleToken = jwt.sign(
    {
        iss: 'supabase',
        ref: 'localhost',
        role: 'service_role',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 years
    },
    JWT_SECRET
)

console.log('====================================')
console.log('GENERATED JWT TOKENS')
console.log('====================================')
console.log('\nANON_KEY=')
console.log(anonToken)
console.log('\nSERVICE_ROLE_KEY=')
console.log(serviceRoleToken)
console.log('\n====================================')
console.log('\nUpdate your .env file with these keys!')
