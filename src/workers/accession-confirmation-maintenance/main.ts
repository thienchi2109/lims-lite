import { runAccessionMaintenanceRuntime } from './runtime'

void runAccessionMaintenanceRuntime().then((outcome) => {
    console.info(JSON.stringify({ event: 'accession_maintenance_finished', ...outcome, timestamp: new Date().toISOString() }))
}).catch(() => {
    console.error(JSON.stringify({
        event: 'accession_maintenance_failed', outcomeCode: 'MAINTENANCE_UNCERTAIN',
        timestamp: new Date().toISOString(),
    }))
    process.exitCode = 1
})
