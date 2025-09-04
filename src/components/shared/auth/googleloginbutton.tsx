"use client"

import { Button } from "@/components/ui/button"
import { FcGoogle } from "react-icons/fc"

type GoogleLoginButtonProps = {
  handleGoogleLogin: () => void
  loading: boolean
}

export default function GoogleLoginButton({
  handleGoogleLogin,
  loading,
}: GoogleLoginButtonProps) {
  return (
    <div className="mt-4">
      <div className="my-4 flex items-center justify-center">
        <span className="text-sm text-muted-foreground">o continuar con</span>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full flex items-center justify-center gap-2"
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        <FcGoogle className="text-xl" />
        Google
      </Button>
    </div>
  )
}

