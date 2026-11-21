import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { APPLICATION_NAME } from '@pharmacy/shared';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: APPLICATION_NAME,
  description: 'Pharmacy management for a local pharmacy in Al-Hamdaniyah, Mosul, Iraq.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
