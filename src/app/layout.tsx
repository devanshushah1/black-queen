import './globals.css';
import { SoundsPreloader } from '@/components/SoundsPreloader';

export const metadata = {
  title: 'Black Queen',
  description: '4-player trick-taking card game',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SoundsPreloader />
        {children}
      </body>
    </html>
  );
}
