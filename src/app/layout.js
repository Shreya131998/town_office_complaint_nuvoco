import './globals.css';

export const metadata = {
  title: 'Resident Complaint Portal — Town Office',
  description: 'Submit your residential complaint to the Town Office. Report water, electricity, road, garbage, and other issues quickly and easily.',
  keywords: 'complaint, town office, resident, water supply, electricity, road, garbage',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
