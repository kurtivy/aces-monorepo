import Image from 'next/image';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 - Page Not Found | ACES.fun',
  description: 'Sorry, the page you are looking for could not be found.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-[#D0B264]">
      {/* 404 Text */}
      <h1 className="font-neue-world text-6xl md:text-8xl font-bold mb-2 text-center">404</h1>

      {/* 404 Image */}
      <div className="mb-2">
        <Image
          src="/404-image.png"
          alt="404 Error"
          width={400}
          height={400}
          className="object-contain"
          priority
        />
      </div>

      {/* Error Message */}
      <p className="font-proxima-nova text-xl md:text-2xl text-center text-[#D0B264]">
        Sorry, this page was not found
      </p>
    </div>
  );
}
