"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Props = {
  showMfaDialog: boolean
  setShowMfaDialog: (open: boolean) => void
  verificationCode: string[]
  onOtpChange: (index: number, value: string) => void
  onOtpKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, index: number) => void
  setInputRef: (index: number) => (el: HTMLInputElement | null) => void
  verifyMfaCode: () => void
  completeEnrollMfa: () => void
  loadingMfa: boolean
  loadingLogin: boolean
  isLogin: boolean
  isEnrollingMfa: boolean
  loading: boolean
}

export default function MfaDialog({
  showMfaDialog,
  setShowMfaDialog,
  verificationCode,
  onOtpChange,
  onOtpKeyDown,
  setInputRef,
  verifyMfaCode,
  completeEnrollMfa,
  loadingMfa,
  loadingLogin,
  isLogin,
  isEnrollingMfa,
  loading,
}: Props) {
  return (
    <Dialog open={showMfaDialog} onOpenChange={(open) => !loading && setShowMfaDialog(open)}>
      <DialogContent className="max-w-sm" aria-describedby="mfa-desc">
        <DialogHeader>
          <DialogTitle>Verificación en dos pasos</DialogTitle>
        </DialogHeader>

        <p id="mfa-desc" className="mb-4">
          Ingresa el código de 6 dígitos enviado a tu teléfono.
        </p>

        <div className="flex justify-center gap-2">
          {verificationCode.map((digit, i) => (
            <Input
              key={i}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => onOtpChange(i, e.target.value)}
              onKeyDown={(e) => onOtpKeyDown(e, i)}
              ref={setInputRef(i)}
              className="w-12 h-12 text-center text-2xl font-mono"
              autoFocus={i === 0}
              disabled={loadingMfa}
            />
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1"
            onClick={isEnrollingMfa ? completeEnrollMfa : verifyMfaCode}
            disabled={loadingMfa || verificationCode.some((d) => d === "")}
          >
            {loadingLogin ? "Verificando..." : isLogin ? "Entrar" : "Registrarse"}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => !loading && setShowMfaDialog(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
