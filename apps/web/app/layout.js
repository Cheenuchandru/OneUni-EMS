import './globals.css';
import { AuthProvider } from '../components/AuthProvider';

export const metadata = {
  title: 'OneUni EMS — Oneuni Agri Platform Pvt Ltd · The company behind Agri.in',
  description: 'Enterprise Employee Management System for Oneuni Agri Platform Pvt Ltd, the DPIIT-recognised company behind Agri.in, Milk.in, and TheOrganic.in.',
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.ico',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="overflow-x-hidden max-w-full" suppressHydrationWarning>
      <body className="antialiased bg-[#051812] text-slate-100 selection:bg-emerald-500 selection:text-white overflow-x-hidden max-w-full w-full" suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

