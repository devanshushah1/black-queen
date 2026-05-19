import { Playfair_Display, Outfit } from 'next/font/google';
import './globals.css';
import { SoundsPreloader } from '@/components/SoundsPreloader';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata = {
  title: 'Black Queen',
  description: '4-player trick-taking card game',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${outfit.variable} font-sans`}>
      <body>
        <SoundsPreloader />
        {children}
      </body>
    </html>
  );
}
