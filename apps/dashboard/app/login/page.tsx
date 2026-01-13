import { LoginForm } from "@/components/login-form"
import { AuthLayout } from "@/components/auth/auth-layout"

export default function LoginPage() {
    return (
        <AuthLayout
            heading="Welcome Back"
            subheading="Enter your credentials to access your dashboard"
        >
            <LoginForm />
        </AuthLayout>
    )
}
