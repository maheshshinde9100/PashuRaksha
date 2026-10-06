import { Geist } from "next/font/google";
import "./globals.css";
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
export const metadata = { title: "PashuRaksha | Smart Livestock Health Monitoring", description: "A practical platform for connected cattle health monitoring." };
export default function RootLayout({ children }) { return <html lang="en" className={geist.variable}><body>{children}</body></html>; }
