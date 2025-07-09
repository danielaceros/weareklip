"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import PhoneInput from "react-phone-number-input"
import "react-phone-number-input/style.css"
import { isValidPhoneNumber } from "react-phone-number-input"
import { auth } from "@/lib/firebase"
import { User } from "firebase/auth"

type PhoneEnrollDialogProps = {
  showEnrollPhone: boolean
  setShowEnrollPhone: (open: boolean) => void
  phoneNumber?: string
  setPhoneNumber: (value?: string) => void
  enrollMfaForUser: (user: User, phone: string) => void
  loading: boolean
}

export default function PhoneEnrollDialog({
  showEnrollPhone,
  setShowEnrollPhone,
  phoneNumber,
  setPhoneNumber,
  enrollMfaForUser,
  loading,
}: PhoneEnrollDialogProps) {
  return (
    <Dialog open={showEnrollPhone} onOpenChange={(open) => !loading && setShowEnrollPhone(open)}>
      <DialogContent className="max-w-sm" aria-describedby="enroll-phone-desc">
        <DialogHeader>
          <DialogTitle>Registra tu teléfono para 2FA</DialogTitle>
        </DialogHeader>

        <p id="enroll-phone-desc" className="mb-4">
          Para mayor seguridad, ingresa tu número de teléfono para activar la autenticación en dos pasos.
        </p>

        <PhoneInput
          placeholder="Introduce tu número de teléfono"
          value={phoneNumber}
          onChange={setPhoneNumber}
          defaultCountry="ES"
          international
          countryCallingCodeEditable={false}
          disabled={loading}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-black"
        />

        {phoneNumber && !isValidPhoneNumber(phoneNumber) && (
          <p className="mt-1 text-sm text-red-500">Número de teléfono inválido</p>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => phoneNumber && auth.currentUser && enrollMfaForUser(auth.currentUser, phoneNumber)}
            disabled={loading || !phoneNumber || !isValidPhoneNumber(phoneNumber)}
          >
            Enviar código
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => !loading && setShowEnrollPhone(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
