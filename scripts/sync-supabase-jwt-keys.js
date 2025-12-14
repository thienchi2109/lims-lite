const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')

function readFileIfExists(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8')
    } catch {
        return null
    }
}

function getEnvValue(fileContent, key) {
    const match = fileContent.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return match ? match[1].trim() : null
}

function setEnvValue(fileContent, key, value) {
    const line = `${key}=${value}`
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(fileContent)) return fileContent.replace(regex, line)
    const suffix = fileContent.endsWith('\n') ? '' : '\n'
    return fileContent + suffix + line + '\n'
}

function generateKey({ jwtSecret, role, expiresInSeconds }) {
    const now = Math.floor(Date.now() / 1000)
    return jwt.sign(
        {
            iss: 'supabase-demo',
            role,
            iat: now,
            exp: now + expiresInSeconds,
        },
        jwtSecret
    )
}

const root = process.cwd()
const envPath = path.join(root, '.env')
const envLocalPath = path.join(root, '.env.local')

const envContent = readFileIfExists(envPath)
if (!envContent) {
    console.error('Missing .env file. Create it first (see docs/DOCKER_SETUP.md).')
    process.exit(1)
}

const jwtSecret = getEnvValue(envContent, 'JWT_SECRET')
if (!jwtSecret) {
    console.error('Missing JWT_SECRET in .env. Cannot generate keys.')
    process.exit(1)
}

const tenYearsSeconds = 10 * 365 * 24 * 60 * 60
const anonKey = generateKey({ jwtSecret, role: 'anon', expiresInSeconds: tenYearsSeconds })
const serviceRoleKey = generateKey({
    jwtSecret,
    role: 'service_role',
    expiresInSeconds: tenYearsSeconds,
})

let nextEnvContent = envContent
nextEnvContent = setEnvValue(nextEnvContent, 'ANON_KEY', anonKey)
nextEnvContent = setEnvValue(nextEnvContent, 'SERVICE_ROLE_KEY', serviceRoleKey)
nextEnvContent = setEnvValue(nextEnvContent, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey)

fs.writeFileSync(envPath, nextEnvContent, 'utf8')

const envLocalContent = readFileIfExists(envLocalPath)
if (envLocalContent) {
    let nextEnvLocalContent = envLocalContent
    nextEnvLocalContent = setEnvValue(nextEnvLocalContent, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey)
    nextEnvLocalContent = setEnvValue(
        nextEnvLocalContent,
        'SUPABASE_SERVICE_ROLE_KEY',
        serviceRoleKey
    )
    nextEnvLocalContent = setEnvValue(nextEnvLocalContent, 'SERVICE_ROLE_KEY', serviceRoleKey)
    fs.writeFileSync(envLocalPath, nextEnvLocalContent, 'utf8')
}

console.log('Updated Supabase keys in .env' + (envLocalContent ? ' and .env.local' : '') + '.')
console.log('Next steps:')
console.log('- Restart Docker: docker-compose down && docker-compose up -d')
console.log('- Restart Next.js dev server')
console.log('- Clear browser cookies and log in again')

