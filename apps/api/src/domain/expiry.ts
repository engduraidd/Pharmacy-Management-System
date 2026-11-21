import { Injectable } from '@nestjs/common';
import { settings } from '../config/settings';

export function isCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

@Injectable()
export class ExpiryChecker {
  today(now = new Date()): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: settings().timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const part = (name: string) => parts.find(p => p.type === name)!.value;
    return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
  }

  threshold(now = new Date()): Date {
    const date = this.today(now);
    date.setUTCDate(date.getUTCDate() + settings().expiryAlertDays);
    return date;
  }

  status(expiryDate: Date, now = new Date()): 'EXPIRED' | 'EXPIRING' | 'VALID' {
    if (expiryDate <= this.today(now)) return 'EXPIRED';
    return expiryDate <= this.threshold(now) ? 'EXPIRING' : 'VALID';
  }
}
