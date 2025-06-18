import NavMenu from '@/components/ui/nav-menu';
import BackButton from '@/components/ui/back-button';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <NavMenu />
      <BackButton />

      <div className="max-w-3xl w-full bg-[#231F20] rounded-lg shadow-lg p-8 space-y-6 border border-[#D0B264]/40">
        <h1 className="text-4xl font-syne font-bold text-[#D0B264] text-center mb-4">
          Privacy Policy
        </h1>
      </div>
    </div>
  );
}
