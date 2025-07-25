interface MediaTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  photosCount: number;
  videosCount: number;
}

export default function MediaTabs({
  activeTab,
  onTabChange,
  photosCount,
  videosCount,
}: MediaTabsProps) {
  return (
    <div className="flex space-x-2 mb-6">
      <button
        onClick={() => onTabChange('photos')}
        className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm ${
          activeTab === 'photos'
            ? 'bg-[#D0B284] text-black border border-[#D0B284]'
            : 'bg-black/20 text-[#DCDDCC] border border-[#D0B284]/30 hover:text-[#D0B284] hover:border-[#D0B284]/50'
        }`}
      >
        Photos ({photosCount})
      </button>
      {videosCount > 0 && (
        <button
          onClick={() => onTabChange('videos')}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm ${
            activeTab === 'videos'
              ? 'bg-[#D0B284] text-black border border-[#D0B284]'
              : 'bg-black/20 text-[#DCDDCC] border border-[#D0B284]/30 hover:text-[#D0B284] hover:border-[#D0B284]/50'
          }`}
        >
          Videos ({videosCount})
        </button>
      )}
    </div>
  );
}
