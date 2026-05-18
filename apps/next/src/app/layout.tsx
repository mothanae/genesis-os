import type { Metadata } from 'next';
import { Providers } from './providers';
import { ToastContainer } from '@/components/ui/toast-container';
import './globals.css';

export const metadata: Metadata = {
  title: 'Genesis-1 | Platform Builder',
  description: 'Design, simulate, and deploy software architectures with AI agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Providers>{children}</Providers>
        <ToastContainer />
      </body>
    </html>
  );
}
