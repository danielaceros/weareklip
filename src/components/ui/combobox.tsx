"use client"

import * as React from "react"
import { ChevronsUpDown } from "lucide-react"
// import { cn } from "@/lib/utils" // ❌ Eliminado porque no se usa
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type Option = {
  label: string
  value: string
  badge?: string
}

type ComboboxProps = {
  options: Option[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  allowCustom?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar...",
  allowCustom = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const handleSelect = (selected: string) => {
    onValueChange(selected)
    setOpen(false)
  }

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  )

  const selectedLabel =
    options.find((option) => option.value === value)?.label || value

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedLabel || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Buscar..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandEmpty>No hay coincidencias.</CommandEmpty>
          <CommandGroup>
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.value}
                onSelect={() => handleSelect(option.value)}
              >
                <div className="flex items-center justify-between w-full">
                  <span>{option.label}</span>
                  {option.badge && (
                    <Badge variant="default" className="ml-2 text-xs">
                      {option.badge}
                    </Badge>
                  )}
                </div>
              </CommandItem>
            ))}

            {allowCustom &&
              inputValue &&
              !filteredOptions.some((o) => o.value === inputValue) && (
                <CommandItem onSelect={() => handleSelect(inputValue)}>
                  <span className="text-muted-foreground">
                    Usar: &quot;{inputValue}&quot;
                  </span>
                </CommandItem>
              )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
