'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FlaskConical, Lock, User, Loader2, AlertCircle } from 'lucide-react'

type FormState = {
    error?: {
        username?: string[]
        password?: string[]
        general?: string[]
    }
} | null

export default function LoginPage() {
    const [state, formAction, isPending] = useActionState<FormState, FormData>(login, null)

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
            <div className="w-full max-w-lg md:max-w-xl space-y-8">
                <div className="flex flex-col items-center justify-center space-y-2 text-center">
                    <div className="rounded-full bg-primary/10 p-4">
                        <FlaskConical className="h-10 w-10 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Welcome back
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Sign in to your account to continue
                    </p>
                </div>

                <Card className="border-border/50 shadow-xl">
                    <CardHeader className="space-y-1 pb-6">
                        <CardTitle className="text-lg md:text-xl text-center leading-6 md:leading-7">Hệ thống quản lý thông tin khoa Xét nghiệm</CardTitle>
                        <CardDescription className="text-center">
                            Laboratory Information Management System
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={formAction} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="username"
                                        name="username"
                                        type="text"
                                        placeholder="Enter your username"
                                        required
                                        disabled={isPending}
                                        className="pl-9"
                                        aria-invalid={!!state?.error?.username}
                                        aria-describedby={state?.error?.username ? "username-error" : undefined}
                                    />
                                </div>
                                {state?.error?.username && (
                                    <p id="username-error" className="text-sm text-destructive flex items-center gap-1 mt-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {state.error.username[0]}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="Enter your password"
                                        required
                                        disabled={isPending}
                                        className="pl-9"
                                        aria-invalid={!!state?.error?.password}
                                        aria-describedby={state?.error?.password ? "password-error" : undefined}
                                    />
                                </div>
                                {state?.error?.password && (
                                    <p id="password-error" className="text-sm text-destructive flex items-center gap-1 mt-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {state.error.password[0]}
                                    </p>
                                )}
                            </div>

                            {state?.error?.general && (
                                <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-start gap-2 border border-destructive/20">
                                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                    <p>{state.error.general[0]}</p>
                                </div>
                            )}

                            <Button type="submit" className="w-full" disabled={isPending} size="lg">
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="flex justify-center border-t bg-muted/30 py-4">
                        <p className="text-xs text-muted-foreground">
                            Restricted Access • Authorized Personnel Only
                        </p>
                    </CardFooter>
                </Card>
                
                <p className="text-center text-xs text-muted-foreground px-8">
                    &copy; {new Date().getFullYear()} Hệ thống quản lý thông tin khoa Xét nghiệm. All rights reserved.
                </p>
            </div>
        </div>
    )
}
