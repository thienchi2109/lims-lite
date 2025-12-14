/**
 * CoA Generation Test Page
 *
 * Temporary page for testing CoA generation
 * Access: http://localhost:3000/test-coa
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function TestCoAPage() {
    const [sampleId, setSampleId] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<{
        success: boolean
        message: string
        coaId?: string
        filePath?: string
    } | null>(null)

    const handleGenerate = async () => {
        if (!sampleId) {
            setResult({
                success: false,
                message: 'Please enter a sample ID'
            })
            return
        }

        setIsLoading(true)
        setResult(null)

        try {
            const response = await fetch('/api/test-generate-coa', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sampleId }),
            })

            const data = await response.json()

            if (data.success) {
                setResult({
                    success: true,
                    message: 'CoA generated successfully!',
                    coaId: data.coaId,
                    filePath: data.filePath
                })
            } else {
                setResult({
                    success: false,
                    message: data.error || 'Failed to generate CoA'
                })
            }
        } catch (error) {
            setResult({
                success: false,
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="container max-w-2xl mx-auto py-10">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">CoA Generation Test</h1>
                    <p className="text-gray-600 mt-2">
                        Generate Certificate of Analysis for a completed sample
                    </p>
                </div>

                <div className="bg-white rounded-lg shadow border p-6 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="sampleId">Sample ID (UUID)</Label>
                        <Input
                            id="sampleId"
                            type="text"
                            placeholder="Enter sample UUID"
                            value={sampleId}
                            onChange={(e) => setSampleId(e.target.value)}
                            disabled={isLoading}
                        />
                        <p className="text-sm text-gray-500">
                            Enter the UUID of a completed sample with approved results
                        </p>
                    </div>

                    <Button
                        onClick={handleGenerate}
                        disabled={isLoading || !sampleId}
                        className="w-full"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating CoA...
                            </>
                        ) : (
                            'Generate CoA'
                        )}
                    </Button>
                </div>

                {result && (
                    <Alert variant={result.success ? 'default' : 'destructive'}>
                        {result.success ? (
                            <CheckCircle className="h-4 w-4" />
                        ) : (
                            <XCircle className="h-4 w-4" />
                        )}
                        <AlertDescription>
                            <p className="font-medium">{result.message}</p>
                            {result.coaId && (
                                <div className="mt-2 text-sm space-y-1">
                                    <p><strong>CoA ID:</strong> {result.coaId}</p>
                                    <p><strong>File Path:</strong> {result.filePath}</p>
                                </div>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">How to find Sample ID:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                        <li>Log in as Manager</li>
                        <li>Go to Samples list</li>
                        <li>Click on a completed sample</li>
                        <li>Copy the UUID from the URL or sample details</li>
                    </ol>
                </div>
            </div>
        </div>
    )
}
