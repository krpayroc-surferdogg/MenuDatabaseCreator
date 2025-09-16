'use client';
import dynamic from 'next/dynamic';
const MenuExtractor = dynamic(() => import('../components/MenuExtractor'), { ssr: false });

export default function Page() {
  return <MenuExtractor />;
}
