import { SignupForm } from "@/components/signup-form"
import { AuthLayout } from "@/components/auth/auth-layout"

export default function SignupPage() {
    return (
        <AuthLayout
            heading="Create Account"
            subheading="Get started with your AI email assistant today"
        >
            <SignupForm />
        </AuthLayout>
    )
}
