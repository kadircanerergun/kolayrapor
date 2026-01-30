'use client'

import React, { type FC, useState, useEffect, useRef } from 'react'
import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Calendar } from './calendar'
import { DateInput } from './date-input'
import { Label } from './label'
import { Switch } from './switch'
import { CheckIcon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/utils/tailwind'
import { tr } from 'react-day-picker/locale'

export interface DateRangePickerProps {
  onUpdate?: (values: { range: DateRange, rangeCompare?: DateRange }) => void
  initialDateFrom?: Date | string
  initialDateTo?: Date | string
  initialCompareFrom?: Date | string
  initialCompareTo?: Date | string
  align?: 'start' | 'center' | 'end'
  locale?: string
  showCompare?: boolean
}

const formatDate = (date: Date, locale: string = 'tr-TR'): string => {
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const getDateAdjustedForTimezone = (dateInput: Date | string): Date => {
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-').map((part) => parseInt(part, 10))
    const date = new Date(parts[0], parts[1] - 1, parts[2])
    return date
  } else {
    return dateInput
  }
}

interface DateRange {
  from: Date
  to: Date | undefined
}

interface Preset {
  name: string
  label: string
}

const PRESETS: Preset[] = [
  { name: 'today', label: 'Bugun' },
  { name: 'yesterday', label: 'Dun' },
  { name: 'last7', label: 'Son 7 gun' },
  { name: 'last14', label: 'Son 14 gun' },
  { name: 'last30', label: 'Son 30 gun' },
  { name: 'thisWeek', label: 'Bu Hafta' },
  { name: 'lastWeek', label: 'Gecen Hafta' },
  { name: 'thisMonth', label: 'Bu Ay' },
  { name: 'lastMonth', label: 'Gecen Ay' }
]

export const DateRangePicker: FC<DateRangePickerProps> = ({
  initialDateFrom = new Date(new Date().setHours(0, 0, 0, 0)),
  initialDateTo,
  initialCompareFrom,
  initialCompareTo,
  onUpdate,
  align = 'start',
  locale = 'tr-TR',
  showCompare = false
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const [range, setRange] = useState<DateRange>({
    from: getDateAdjustedForTimezone(initialDateFrom),
    to: initialDateTo
      ? getDateAdjustedForTimezone(initialDateTo)
      : getDateAdjustedForTimezone(initialDateFrom)
  })
  const [rangeCompare, setRangeCompare] = useState<DateRange | undefined>(
    initialCompareFrom
      ? {
          from: new Date(new Date(initialCompareFrom).setHours(0, 0, 0, 0)),
          to: initialCompareTo
            ? new Date(new Date(initialCompareTo).setHours(0, 0, 0, 0))
            : new Date(new Date(initialCompareFrom).setHours(0, 0, 0, 0))
        }
      : undefined
  )

  const openedRangeRef = useRef<DateRange | undefined>(undefined)
  const openedRangeCompareRef = useRef<DateRange | undefined>(undefined)

  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined)

  const getPresetRange = (presetName: string): DateRange => {
    const preset = PRESETS.find(({ name }) => name === presetName)
    if (!preset) throw new Error(`Unknown date range preset: ${presetName}`)
    const from = new Date()
    const to = new Date()
    const first = from.getDate() - from.getDay()

    switch (preset.name) {
      case 'today':
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'yesterday':
        from.setDate(from.getDate() - 1)
        from.setHours(0, 0, 0, 0)
        to.setDate(to.getDate() - 1)
        to.setHours(23, 59, 59, 999)
        break
      case 'last7':
        from.setDate(from.getDate() - 6)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'last14':
        from.setDate(from.getDate() - 13)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'last30':
        from.setDate(from.getDate() - 29)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'thisWeek':
        from.setDate(first + 1) // Monday
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'lastWeek':
        from.setDate(from.getDate() - 7 - from.getDay() + 1) // Last Monday
        to.setDate(from.getDate() + 6) // Last Sunday
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'thisMonth':
        from.setDate(1)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        break
      case 'lastMonth':
        from.setMonth(from.getMonth() - 1)
        from.setDate(1)
        from.setHours(0, 0, 0, 0)
        to.setDate(0)
        to.setHours(23, 59, 59, 999)
        break
    }

    return { from, to }
  }

  const setPreset = (preset: string): void => {
    const range = getPresetRange(preset)
    setRange(range)
    if (rangeCompare) {
      const rangeCompare = {
        from: new Date(
          range.from.getFullYear() - 1,
          range.from.getMonth(),
          range.from.getDate()
        ),
        to: range.to
          ? new Date(
            range.to.getFullYear() - 1,
            range.to.getMonth(),
            range.to.getDate()
          )
          : undefined
      }
      setRangeCompare(rangeCompare)
    }
  }

  const checkPreset = (): void => {
    for (const preset of PRESETS) {
      const presetRange = getPresetRange(preset.name)

      const normalizedRangeFrom = new Date(range.from)
      normalizedRangeFrom.setHours(0, 0, 0, 0)
      const normalizedPresetFrom = new Date(
        presetRange.from.setHours(0, 0, 0, 0)
      )

      const normalizedRangeTo = new Date(range.to ?? 0)
      normalizedRangeTo.setHours(0, 0, 0, 0)
      const normalizedPresetTo = new Date(
        presetRange.to?.setHours(0, 0, 0, 0) ?? 0
      )

      if (
        normalizedRangeFrom.getTime() === normalizedPresetFrom.getTime() &&
        normalizedRangeTo.getTime() === normalizedPresetTo.getTime()
      ) {
        setSelectedPreset(preset.name)
        return
      }
    }

    setSelectedPreset(undefined)
  }

  const resetValues = (): void => {
    setRange({
      from:
        typeof initialDateFrom === 'string'
          ? getDateAdjustedForTimezone(initialDateFrom)
          : initialDateFrom,
      to: initialDateTo
        ? typeof initialDateTo === 'string'
          ? getDateAdjustedForTimezone(initialDateTo)
          : initialDateTo
        : typeof initialDateFrom === 'string'
          ? getDateAdjustedForTimezone(initialDateFrom)
          : initialDateFrom
    })
    setRangeCompare(
      initialCompareFrom
        ? {
            from:
              typeof initialCompareFrom === 'string'
                ? getDateAdjustedForTimezone(initialCompareFrom)
                : initialCompareFrom,
            to: initialCompareTo
              ? typeof initialCompareTo === 'string'
                ? getDateAdjustedForTimezone(initialCompareTo)
                : initialCompareTo
              : typeof initialCompareFrom === 'string'
                ? getDateAdjustedForTimezone(initialCompareFrom)
                : initialCompareFrom
          }
        : undefined
    )
  }

  useEffect(() => {
    checkPreset()
  }, [range])

  const PresetButton = ({
    preset,
    label,
    isSelected
  }: {
    preset: string
    label: string
    isSelected: boolean
  }) => (
    <Button
      className={cn(isSelected && 'pointer-events-none')}
      variant="ghost"
      onClick={() => {
        setPreset(preset)
      }}
    >
      <>
        <span className={cn('pr-2 opacity-0', isSelected && 'opacity-70')}>
          <CheckIcon className="h-4 w-4" />
        </span>
        {label}
      </>
    </Button>
  )

  const areRangesEqual = (a?: DateRange, b?: DateRange): boolean => {
    if (!a || !b) return a === b
    return (
      a.from.getTime() === b.from.getTime() &&
      (!a.to || !b.to || a.to.getTime() === b.to.getTime())
    )
  }

  useEffect(() => {
    if (isOpen) {
      openedRangeRef.current = range
      openedRangeCompareRef.current = rangeCompare
    }
  }, [isOpen])

  return (
    <Popover
      modal={true}
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) {
          resetValues()
        }
        setIsOpen(open)
      }}
    >
      <PopoverTrigger asChild>
        <Button size={'lg'} variant="outline">
          <div className="text-right">
            <div className="py-1">
              <div>{`${formatDate(range.from, locale)}${
                range.to != null ? ' - ' + formatDate(range.to, locale) : ''
              }`}</div>
            </div>
            {rangeCompare != null && (
              <div className="opacity-60 text-xs -mt-1">
                <>
                  vs. {formatDate(rangeCompare.from, locale)}
                  {rangeCompare.to != null
                    ? ` - ${formatDate(rangeCompare.to, locale)}`
                    : ''}
                </>
              </div>
            )}
          </div>
          <div className="pl-1 opacity-60 -mr-2 scale-125">
            {isOpen ? (<ChevronUpIcon width={24} />) : (<ChevronDownIcon width={24} />)}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <div className="flex">
          <div className="flex flex-col">
            <div className="flex flex-col gap-2 border-b border-border p-3">
              {showCompare && (
                <div className="flex items-center space-x-2 py-1">
                  <Switch
                    defaultChecked={Boolean(rangeCompare)}
                    onCheckedChange={(checked: boolean) => {
                      if (checked) {
                        if (!range.to) {
                          setRange({
                            from: range.from,
                            to: range.from
                          })
                        }
                        setRangeCompare({
                          from: new Date(
                            range.from.getFullYear(),
                            range.from.getMonth(),
                            range.from.getDate() - 365
                          ),
                          to: range.to
                            ? new Date(
                              range.to.getFullYear() - 1,
                              range.to.getMonth(),
                              range.to.getDate()
                            )
                            : new Date(
                              range.from.getFullYear() - 1,
                              range.from.getMonth(),
                              range.from.getDate()
                            )
                        })
                      } else {
                        setRangeCompare(undefined)
                      }
                    }}
                    id="compare-mode"
                  />
                  <Label htmlFor="compare-mode">Karsilastir</Label>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <DateInput
                    value={range.from}
                    onChange={(date) => {
                      const toDate =
                        range.to == null || date > range.to ? date : range.to
                      setRange((prevRange) => ({
                        ...prevRange,
                        from: date,
                        to: toDate
                      }))
                    }}
                  />
                  <span className="text-muted-foreground">-</span>
                  <DateInput
                    value={range.to}
                    onChange={(date) => {
                      const fromDate = date < range.from ? date : range.from
                      setRange((prevRange) => ({
                        ...prevRange,
                        from: fromDate,
                        to: date
                      }))
                    }}
                  />
                </div>
                {rangeCompare != null && (
                  <div className="flex items-center gap-2">
                    <DateInput
                      value={rangeCompare?.from}
                      onChange={(date) => {
                        if (rangeCompare) {
                          const compareToDate =
                            rangeCompare.to == null || date > rangeCompare.to
                              ? date
                              : rangeCompare.to
                          setRangeCompare((prevRangeCompare) => ({
                            ...prevRangeCompare,
                            from: date,
                            to: compareToDate
                          }))
                        } else {
                          setRangeCompare({
                            from: date,
                            to: new Date()
                          })
                        }
                      }}
                    />
                    <span className="text-muted-foreground">-</span>
                    <DateInput
                      value={rangeCompare?.to}
                      onChange={(date) => {
                        if (rangeCompare && rangeCompare.from) {
                          const compareFromDate =
                            date < rangeCompare.from
                              ? date
                              : rangeCompare.from
                          setRangeCompare({
                            ...rangeCompare,
                            from: compareFromDate,
                            to: date
                          })
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            <Calendar
              mode="range"
              locale={tr}
              weekStartsOn={1}
              onSelect={(value: { from?: Date, to?: Date } | undefined) => {
                if (value?.from != null) {
                  setRange({ from: value.from, to: value?.to })
                }
              }}
              selected={range}
              numberOfMonths={1}
              defaultMonth={new Date()}
            />
          </div>
          <div className="flex flex-col gap-1 border-l border-border p-3">
            {PRESETS.map((preset) => (
              <PresetButton
                key={preset.name}
                preset={preset.name}
                label={preset.label}
                isSelected={selectedPreset === preset.name}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsOpen(false)
              resetValues()
            }}
          >
            Iptal
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setIsOpen(false)
              if (
                !areRangesEqual(range, openedRangeRef.current) ||
                !areRangesEqual(rangeCompare, openedRangeCompareRef.current)
              ) {
                onUpdate?.({ range, rangeCompare })
              }
            }}
          >
            Uygula
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

DateRangePicker.displayName = 'DateRangePicker'
